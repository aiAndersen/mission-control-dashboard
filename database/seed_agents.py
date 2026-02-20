#!/usr/bin/env python3
"""
Agent Discovery Script

Scans Python scripts in the marketing content portal and automatically
populates the Mission Control agents registry.

Usage:
    python database/seed_agents.py
    python database/seed_agents.py --project-path ~/Desktop/other-project
"""

import os
import sys
import re
import argparse
import json
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()
load_dotenv('.env.local')

DATABASE_URL = os.getenv('DATABASE_URL')
DEFAULT_PROJECT_PATH = "/Users/andrewandersen/Desktop/Marketing Content Database/marketing-content-portal"


def extract_agent_metadata(script_path):
    """Extract metadata from agent script docstring and argparse."""
    with open(script_path, 'r') as f:
        content = f.read()

    # Extract docstring
    docstring_match = re.search(r'"""(.*?)"""', content, re.DOTALL)
    description = ''
    if docstring_match:
        docstring = docstring_match.group(1).strip()
        lines = docstring.split('\n')
        description = lines[0] if lines else ''

    # Extract argparse parameters
    parameters = {}

    # Look for common patterns
    if '--limit' in content:
        limit_match = re.search(r"'--limit'.*?default=(\d+)", content)
        if limit_match:
            parameters['--limit'] = int(limit_match.group(1))

    if '--model' in content:
        model_match = re.search(r"AI_MODEL\s*=\s*['\"]([^'\"]+)", content)
        if model_match:
            parameters['--model'] = model_match.group(1)

    # Extract steps count from docstring
    steps_match = re.search(r'Steps?:\s*\n(.*?)(?:\n\n|Usage:)', docstring_match.group(1), re.DOTALL) if docstring_match else None
    steps_count = 0
    if steps_match:
        steps_text = steps_match.group(1)
        steps_count = len(re.findall(r'^\s*\d+\.', steps_text, re.MULTILINE))

    # Determine tags
    tags = ['python']
    script_name = Path(script_path).stem

    if 'enrich' in script_name or 'enrich' in description.lower():
        tags.append('enrichment')
    if 'import' in script_name or 'import' in description.lower():
        tags.append('import')
    if 'diagnose' in script_name or 'debug' in description.lower():
        tags.append('debugging')
    if 'health' in script_name or 'monitor' in description.lower():
        tags.append('monitoring')
    if 'deploy' in script_name or 'preflight' in description.lower():
        tags.append('deployment')
    if 'maintenance' in script_name or 'orchestrat' in description.lower():
        tags.append('orchestration')

    # Check if expensive (uses gpt-5.2 or has high limits)
    if 'gpt-5.2' in content or 'gpt-5-mini' in content:
        tags.append('ai-powered')

    return {
        'description': description[:500],  # Limit length
        'parameters': parameters,
        'steps_count': steps_count,
        'tags': tags,
    }


def discover_agents(project_path):
    """Discover all agent scripts in a project."""
    scripts_dir = Path(project_path) / 'scripts'

    # Known agent scripts
    agent_scripts = [
        'deploy_preflight.py',
        'health_monitor.py',
        'diagnose_search.py',
        'import_orchestrator.py',
        'maintenance_orchestrator.py',
        'dedup_content.py',
    ]

    agents = []

    for script_name in agent_scripts:
        script_path = scripts_dir / script_name
        if not script_path.exists():
            print(f"  Warning: {script_name} not found")
            continue

        metadata = extract_agent_metadata(str(script_path))

        agent_name = script_name.replace('.py', '').replace('_', '-')

        agents.append({
            'name': agent_name,
            'description': metadata['description'],
            'script_path': f"scripts/{script_name}",
            'language': 'python',
            'parameters': metadata['parameters'],
            'tags': metadata['tags'],
        })

        print(f"  ✓ Discovered: {agent_name} ({len(metadata['tags'])} tags)")

    return agents


def seed_database(conn, project_name, project_path, github_repo=None):
    """Seed the database with project and agents."""

    # Insert or update project
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO projects (name, github_repo, description)
            VALUES (%s, %s, %s)
            ON CONFLICT (name) DO UPDATE
            SET github_repo = EXCLUDED.github_repo,
                description = EXCLUDED.description
            RETURNING id
        """, (
            project_name,
            github_repo,
            f"Marketing content portal at {project_path}"
        ))
        project_id = cur.fetchone()['id']
        conn.commit()

    print(f"\n✓ Project registered: {project_name} ({project_id})")

    # Discover agents
    print(f"\nDiscovering agents in {project_path}...")
    agents = discover_agents(project_path)

    # Insert agents
    inserted = 0
    updated = 0

    for agent in agents:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO agents (
                    project_id, name, description, script_path,
                    language, parameters, tags
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (project_id, name) DO UPDATE
                SET description = EXCLUDED.description,
                    script_path = EXCLUDED.script_path,
                    parameters = EXCLUDED.parameters,
                    tags = EXCLUDED.tags
                RETURNING (xmax = 0) AS inserted
            """, (
                project_id,
                agent['name'],
                agent['description'],
                agent['script_path'],
                agent['language'],
                json.dumps(agent['parameters']),
                agent['tags']
            ))
            was_inserted = cur.fetchone()['inserted']
            if was_inserted:
                inserted += 1
            else:
                updated += 1
            conn.commit()

    print(f"\n✓ Agents seeded: {inserted} inserted, {updated} updated")

    # Show summary
    with conn.cursor() as cur:
        cur.execute("""
            SELECT name, array_length(tags, 1) as tag_count, description
            FROM agents
            WHERE project_id = %s
            ORDER BY name
        """, (project_id,))
        agents = cur.fetchall()

    print(f"\n{'='*60}")
    print(f"MISSION CONTROL AGENT REGISTRY")
    print(f"Project: {project_name}")
    print(f"{'='*60}")
    for agent in agents:
        print(f"  • {agent['name']} ({agent['tag_count']} tags)")
        print(f"    {agent['description'][:70]}...")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description='Discover and seed agents')
    parser.add_argument('--project-path', type=str, default=DEFAULT_PROJECT_PATH,
                        help='Path to the project to scan')
    parser.add_argument('--project-name', type=str, default='marketing-content-portal',
                        help='Name of the project')
    parser.add_argument('--github-repo', type=str,
                        help='GitHub repo URL')

    args = parser.parse_args()

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    print("="*60)
    print("Mission Control Agent Discovery")
    print("="*60)

    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

    try:
        seed_database(conn, args.project_name, args.project_path, args.github_repo)
    finally:
        conn.close()

    print("\n✓ Done!")


if __name__ == '__main__':
    main()
