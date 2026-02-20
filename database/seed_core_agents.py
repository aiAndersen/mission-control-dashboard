#!/usr/bin/env python3
"""
Seed core worker agents for CEO Agent orchestration
These are the foundational agents that CEO Agent can use to accomplish tasks
"""

import os
import sys
import json
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

# Core worker agents with detailed specifications
CORE_AGENTS = [
    # ===== ARCHITECTURAL & PLANNING =====
    {
        'name': 'architect-planner',
        'description': 'Master architect that designs system architecture, creates technical specifications, and plans project structure. Expert in Supabase, Vercel, React, Node.js, Python, and PostgreSQL. Creates comprehensive READMEs, architecture diagrams, and implementation plans.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/architect_planner.py',
        'language': 'python',
        'parameters': {
            '--project-type': 'web-app',
            '--complexity': 'medium',
            '--model': 'gpt-5.2',
            '--output-format': 'markdown'
        },
        'tags': ['architecture', 'planning', 'design', 'gpt-5.2', 'expensive'],
        'default_schedule': None,
        'estimated_cost': 0.15,  # Per execution
        'capabilities': [
            'system-architecture',
            'database-design',
            'api-design',
            'tech-stack-selection',
            'readme-creation',
            'documentation'
        ]
    },

    # ===== CODE EXECUTION =====
    {
        'name': 'code-executioner',
        'description': 'Heavy-duty coding agent that writes, debugs, and tests production-ready code. Handles full-stack development including frontend (React, Vite), backend (Node.js, Express, Python), and database operations. Includes automated testing and debugging capabilities.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/code_executioner.py',
        'language': 'python',
        'parameters': {
            '--language': 'auto',
            '--include-tests': True,
            '--model': 'gpt-5-mini',
            '--max-files': 10
        },
        'tags': ['coding', 'development', 'testing', 'debugging', 'gpt-5-mini', 'moderate-cost'],
        'default_schedule': None,
        'estimated_cost': 0.08,
        'capabilities': [
            'code-generation',
            'bug-fixing',
            'test-writing',
            'code-refactoring',
            'performance-optimization',
            'error-handling'
        ]
    },

    # ===== UI/UX & DESIGN =====
    {
        'name': 'ui-ux-designer',
        'description': 'UI/UX specialist focused on creating accessible, on-brand, and visually appealing interfaces. Handles CSS, Tailwind, component design, color schemes, typography, and responsive design. Ensures WCAG accessibility compliance and brand consistency.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/ui_ux_designer.py',
        'language': 'python',
        'parameters': {
            '--brand': 'SchooLinks',
            '--framework': 'tailwind',
            '--model': 'gpt-5-mini',
            '--accessibility': 'wcag-aa'
        },
        'tags': ['ui', 'ux', 'design', 'css', 'accessibility', 'gpt-5-mini', 'moderate-cost'],
        'default_schedule': None,
        'estimated_cost': 0.06,
        'capabilities': [
            'ui-design',
            'css-styling',
            'component-creation',
            'accessibility-audit',
            'responsive-design',
            'brand-compliance'
        ]
    },

    # ===== CONTENT PROCESSING & EXTRACTION =====
    {
        'name': 'pdf-ocr-parser',
        'description': 'Advanced document processing agent that extracts text from PDFs, performs OCR on images, and uses AI reasoning to understand and structure parsed content. Handles complex layouts, tables, forms, handwritten text, and multilingual documents. Provides intelligent content analysis, entity extraction, and structured data transformation.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/pdf_ocr_parser.py',
        'language': 'python',
        'parameters': {
            '--ocr-engine': 'tesseract',
            '--ai-reasoning': True,
            '--extract-tables': True,
            '--model': 'gpt-5-mini',
            '--output-format': 'structured-json'
        },
        'tags': ['pdf', 'ocr', 'document-processing', 'ai-reasoning', 'data-extraction', 'gpt-5-mini', 'moderate-cost'],
        'default_schedule': None,
        'estimated_cost': 0.08,
        'capabilities': [
            'pdf-text-extraction',
            'ocr-image-processing',
            'handwritten-text-recognition',
            'table-extraction',
            'form-data-extraction',
            'ai-content-analysis',
            'entity-recognition',
            'document-classification',
            'multilingual-support',
            'structured-output',
            'content-summarization',
            'metadata-extraction'
        ]
    },

    # ===== RESEARCH & DEVELOPMENT =====
    {
        'name': 'research-scientist',
        'description': 'R&D agent that performs parallel research, evaluates technologies, analyzes best practices, and provides data-driven recommendations. Reviews architectural decisions, code quality, and suggests improvements based on industry standards.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/research_scientist.py',
        'language': 'python',
        'parameters': {
            '--depth': 'comprehensive',
            '--model': 'gpt-5.2',
            '--include-comparisons': True,
            '--sources': 5
        },
        'tags': ['research', 'analysis', 'r&d', 'gpt-5.2', 'expensive'],
        'default_schedule': None,
        'estimated_cost': 0.12,
        'capabilities': [
            'technology-research',
            'code-review',
            'best-practices-analysis',
            'competitive-analysis',
            'documentation-review',
            'performance-benchmarking'
        ]
    },

    # ===== API INTEGRATION SPECIALISTS =====
    {
        'name': 'google-api-specialist',
        'description': 'Expert in Google APIs including Google Drive, Google Sheets, Google Calendar, Google Analytics, and Google Cloud Platform services. Handles OAuth, service accounts, and complex API integrations.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/google_api_specialist.py',
        'language': 'python',
        'parameters': {
            '--api-type': 'drive',
            '--auth-method': 'service-account',
            '--model': 'gpt-4o-mini'
        },
        'tags': ['api', 'google', 'integration', 'gpt-4o-mini', 'cheap'],
        'default_schedule': None,
        'estimated_cost': 0.02,
        'capabilities': [
            'google-drive-integration',
            'google-sheets-integration',
            'oauth-setup',
            'service-account-config',
            'batch-operations',
            'file-sync'
        ]
    },

    {
        'name': 'meta-api-specialist',
        'description': 'Expert in Facebook/Meta APIs including Facebook Graph API, Instagram API, Meta Business Suite, and Ad Manager. Handles campaign management, audience targeting, and analytics.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/meta_api_specialist.py',
        'language': 'python',
        'parameters': {
            '--platform': 'facebook',
            '--api-version': 'v18.0',
            '--model': 'gpt-4o-mini'
        },
        'tags': ['api', 'meta', 'facebook', 'advertising', 'gpt-4o-mini', 'cheap'],
        'default_schedule': None,
        'estimated_cost': 0.02,
        'capabilities': [
            'facebook-ads-management',
            'instagram-integration',
            'audience-targeting',
            'campaign-analytics',
            'meta-pixel-setup',
            'catalog-management'
        ]
    },

    {
        'name': 'groundtruth-api-specialist',
        'description': 'Expert in Ground Truth API for educational data, student information systems, and academic analytics. Handles data synchronization, reporting, and compliance requirements.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/groundtruth_api_specialist.py',
        'language': 'python',
        'parameters': {
            '--data-type': 'student-info',
            '--sync-mode': 'incremental',
            '--model': 'gpt-4o-mini'
        },
        'tags': ['api', 'groundtruth', 'education', 'data-sync', 'gpt-4o-mini', 'cheap'],
        'default_schedule': None,
        'estimated_cost': 0.02,
        'capabilities': [
            'student-data-sync',
            'academic-reporting',
            'compliance-validation',
            'data-transformation',
            'webhook-handling',
            'batch-processing'
        ]
    },

    {
        'name': 'hubspot-api-specialist',
        'description': 'Expert in HubSpot APIs for CRM, marketing automation, content management, and analytics. Handles contact/company management, email campaigns, landing pages, blog posts, forms, workflows, and HubSpot-hosted content extraction (PDFs, web pages). Integrates with HubSpot CMS for content enrichment.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/hubspot_api_specialist.py',
        'language': 'python',
        'parameters': {
            '--api-type': 'crm',
            '--auth-method': 'private-app',
            '--model': 'gpt-4o-mini'
        },
        'tags': ['api', 'hubspot', 'crm', 'marketing', 'content-extraction', 'gpt-4o-mini', 'cheap'],
        'default_schedule': None,
        'estimated_cost': 0.02,
        'capabilities': [
            'crm-contact-management',
            'company-management',
            'deal-pipeline-automation',
            'email-campaign-management',
            'landing-page-integration',
            'blog-post-management',
            'form-submission-handling',
            'workflow-automation',
            'hubspot-pdf-extraction',
            'content-enrichment',
            'analytics-reporting'
        ]
    },

    {
        'name': 'webflow-api-specialist',
        'description': 'Expert in Webflow CMS API, Designer API, and Data API. Handles CMS collections and items, site management, page publishing, asset management, form submissions, e-commerce operations, and webhook integrations. Specializes in content sync, landing page imports, and real-time CMS updates used in marketing content portals.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/webflow_api_specialist.py',
        'language': 'python',
        'parameters': {
            '--api-type': 'cms',
            '--auth-method': 'api-token',
            '--model': 'gpt-4o-mini'
        },
        'tags': ['api', 'webflow', 'cms', 'website', 'design', 'content-sync', 'gpt-4o-mini', 'cheap'],
        'default_schedule': None,
        'estimated_cost': 0.02,
        'capabilities': [
            'cms-collection-management',
            'cms-item-crud',
            'site-publishing',
            'page-management',
            'asset-upload-download',
            'form-submission-handling',
            'webhook-setup',
            'content-import-export',
            'landing-page-sync',
            'blog-post-management',
            'resource-library-sync',
            'ecommerce-integration',
            'custom-code-injection',
            'domain-management'
        ]
    },

    # ===== DATABASE & DATA =====
    {
        'name': 'database-architect',
        'description': 'Database specialist for Supabase/PostgreSQL. Designs schemas, writes migrations, optimizes queries, sets up RLS policies, and ensures data integrity. Expert in indexing, performance tuning, and scaling.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/database_architect.py',
        'language': 'python',
        'parameters': {
            '--database': 'postgresql',
            '--provider': 'supabase',
            '--model': 'gpt-5-mini'
        },
        'tags': ['database', 'postgresql', 'supabase', 'gpt-5-mini', 'moderate-cost'],
        'default_schedule': None,
        'estimated_cost': 0.05,
        'capabilities': [
            'schema-design',
            'migration-creation',
            'query-optimization',
            'rls-policies',
            'indexing',
            'backup-strategy'
        ]
    },

    # ===== DEPLOYMENT & DEVOPS =====
    {
        'name': 'deployment-engineer',
        'description': 'DevOps specialist for Vercel, GitHub Actions, and CI/CD pipelines. Handles deployments, environment configuration, secrets management, and monitoring setup.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/deployment_engineer.py',
        'language': 'python',
        'parameters': {
            '--platform': 'vercel',
            '--ci-provider': 'github-actions',
            '--model': 'gpt-4o-mini'
        },
        'tags': ['devops', 'deployment', 'ci-cd', 'vercel', 'gpt-4o-mini', 'cheap'],
        'default_schedule': None,
        'estimated_cost': 0.02,
        'capabilities': [
            'vercel-deployment',
            'github-actions',
            'environment-config',
            'secrets-management',
            'domain-setup',
            'monitoring'
        ]
    },

    # ===== TESTING & QA =====
    {
        'name': 'qa-tester',
        'description': 'Quality assurance specialist that writes comprehensive tests, performs manual testing, and ensures code quality. Handles unit tests, integration tests, E2E tests, and accessibility testing.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/qa_tester.py',
        'language': 'python',
        'parameters': {
            '--test-type': 'all',
            '--coverage-threshold': 80,
            '--model': 'gpt-4o-mini'
        },
        'tags': ['testing', 'qa', 'quality', 'gpt-4o-mini', 'cheap'],
        'default_schedule': None,
        'estimated_cost': 0.03,
        'capabilities': [
            'unit-testing',
            'integration-testing',
            'e2e-testing',
            'accessibility-testing',
            'test-coverage-analysis',
            'bug-reporting'
        ]
    },

    # ===== DOCUMENTATION =====
    {
        'name': 'technical-writer',
        'description': 'Documentation specialist that creates comprehensive technical documentation, API documentation, user guides, and inline code comments. Ensures clarity and completeness.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/technical_writer.py',
        'language': 'python',
        'parameters': {
            '--doc-type': 'technical',
            '--format': 'markdown',
            '--model': 'gpt-4o-mini'
        },
        'tags': ['documentation', 'writing', 'gpt-4o-mini', 'cheap'],
        'default_schedule': None,
        'estimated_cost': 0.02,
        'capabilities': [
            'api-documentation',
            'user-guides',
            'readme-creation',
            'inline-comments',
            'changelog-generation',
            'tutorial-creation'
        ]
    },

    # ===== SECURITY & COMPLIANCE =====
    {
        'name': 'security-auditor',
        'description': 'Security specialist that audits code for vulnerabilities, ensures secure authentication, validates data handling, and checks compliance with security best practices.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/security_auditor.py',
        'language': 'python',
        'parameters': {
            '--severity-threshold': 'medium',
            '--compliance': 'owasp-top-10',
            '--model': 'gpt-5-mini'
        },
        'tags': ['security', 'audit', 'compliance', 'gpt-5-mini', 'moderate-cost'],
        'default_schedule': None,
        'estimated_cost': 0.06,
        'capabilities': [
            'vulnerability-scanning',
            'auth-validation',
            'data-security-audit',
            'secrets-detection',
            'compliance-check',
            'security-recommendations'
        ]
    },

    # ===== PERFORMANCE & OPTIMIZATION =====
    {
        'name': 'performance-optimizer',
        'description': 'Performance specialist that analyzes and optimizes frontend performance, backend efficiency, database queries, and API response times. Uses profiling and benchmarking.',
        'script_path': '/Users/andrewandersen/Desktop/mission-control-dashboard/agents/performance_optimizer.py',
        'language': 'python',
        'parameters': {
            '--target': 'all',
            '--metric': 'lighthouse',
            '--model': 'gpt-5-mini'
        },
        'tags': ['performance', 'optimization', 'speed', 'gpt-5-mini', 'moderate-cost'],
        'default_schedule': None,
        'estimated_cost': 0.05,
        'capabilities': [
            'frontend-optimization',
            'backend-optimization',
            'query-optimization',
            'caching-strategy',
            'bundle-size-reduction',
            'lighthouse-audit'
        ]
    }
]


def seed_agents():
    """Seed core worker agents into the database"""

    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # Get or create default project
    cursor.execute("""
        INSERT INTO projects (name, description)
        VALUES ('Mission Control', 'Core worker agents for CEO Agent orchestration')
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id
    """)
    project_id = cursor.fetchone()['id']

    print(f"\n{'='*70}")
    print(f"Seeding {len(CORE_AGENTS)} Core Worker Agents")
    print(f"{'='*70}\n")

    seeded_count = 0
    updated_count = 0

    for agent_data in CORE_AGENTS:
        # Check if agent already exists
        cursor.execute("""
            SELECT id FROM agents WHERE name = %s AND project_id = %s
        """, (agent_data['name'], project_id))

        existing = cursor.fetchone()

        if existing:
            # Update existing agent
            cursor.execute("""
                UPDATE agents
                SET description = %s,
                    script_path = %s,
                    language = %s,
                    parameters = %s::jsonb,
                    tags = %s,
                    default_schedule = %s
                WHERE id = %s
            """, (
                agent_data['description'],
                agent_data['script_path'],
                agent_data['language'],
                json.dumps(agent_data['parameters']),
                agent_data['tags'],
                agent_data.get('default_schedule'),
                existing['id']
            ))
            updated_count += 1
            status = "✓ UPDATED"
        else:
            # Insert new agent
            cursor.execute("""
                INSERT INTO agents (
                    name, description, script_path, language,
                    parameters, tags, default_schedule, project_id
                )
                VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, %s)
            """, (
                agent_data['name'],
                agent_data['description'],
                agent_data['script_path'],
                agent_data['language'],
                json.dumps(agent_data['parameters']),
                agent_data['tags'],
                agent_data.get('default_schedule'),
                project_id
            ))
            seeded_count += 1
            status = "✓ CREATED"

        # Print agent info
        cost_color = '\033[92m' if agent_data['estimated_cost'] < 0.05 else '\033[93m' if agent_data['estimated_cost'] < 0.10 else '\033[91m'
        reset_color = '\033[0m'

        print(f"{status:12} {agent_data['name']:30} {cost_color}${agent_data['estimated_cost']:.2f}{reset_color} | {', '.join(agent_data['capabilities'][:3])}")

    conn.commit()
    cursor.close()
    conn.close()

    print(f"\n{'='*70}")
    print(f"Summary:")
    print(f"  Created: {seeded_count}")
    print(f"  Updated: {updated_count}")
    print(f"  Total:   {seeded_count + updated_count}")
    print(f"{'='*70}\n")

    # Print cost analysis
    total_cost = sum(agent['estimated_cost'] for agent in CORE_AGENTS)
    cheap_agents = [a for a in CORE_AGENTS if 'cheap' in a['tags']]
    moderate_agents = [a for a in CORE_AGENTS if 'moderate-cost' in a['tags']]
    expensive_agents = [a for a in CORE_AGENTS if 'expensive' in a['tags']]

    print("Cost Analysis:")
    print(f"  Cheap (GPT-4o-mini):    {len(cheap_agents):2} agents | Avg: ${sum(a['estimated_cost'] for a in cheap_agents) / len(cheap_agents):.3f}")
    print(f"  Moderate (GPT-5-mini):  {len(moderate_agents):2} agents | Avg: ${sum(a['estimated_cost'] for a in moderate_agents) / len(moderate_agents):.3f}")
    print(f"  Expensive (GPT-5.2):    {len(expensive_agents):2} agents | Avg: ${sum(a['estimated_cost'] for a in expensive_agents) / len(expensive_agents):.3f}")
    print(f"  Total estimated cost for 1x all agents: ${total_cost:.2f}")
    print()


if __name__ == '__main__':
    seed_agents()
