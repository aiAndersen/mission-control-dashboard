#!/usr/bin/env python3
"""
Phase 4 Migration: CEO Agent Orchestration System

Adds workflow tracking tables for CEO Agent orchestration,
approval gates, and agent self-replication audit trail.
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
load_dotenv('../backend/.env')

DATABASE_URL = os.getenv('DATABASE_URL')

def run_migration():
    print("\n" + "="*60)
    print("Phase 4 Migration: CEO Agent Orchestration")
    print("="*60)

    if not DATABASE_URL:
        print("  ERROR: DATABASE_URL not found in environment")
        print("  Please set DATABASE_URL in backend/.env")
        return False

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        # Read schema file
        with open('schema_phase4.sql', 'r') as f:
            schema_sql = f.read()

        print("\n  Executing Phase 4 schema...")
        cur.execute(schema_sql)
        conn.commit()

        print("  ✓ agent_workflows table created")
        print("  ✓ workflow_approvals table created")
        print("  ✓ agent_code_generations table created")
        print("  ✓ agent_executions updated (workflow_id, step_order columns)")
        print("  ✓ Indexes created")
        print("  ✓ Triggers created")

        # Verify tables
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_name IN ('agent_workflows', 'workflow_approvals', 'agent_code_generations')
        """)
        table_count = cur.fetchone()[0]

        if table_count == 3:
            print(f"\n  ✓ Migration successful! ({table_count}/3 tables confirmed)")
        else:
            print(f"\n  ⚠ Warning: Only {table_count}/3 tables found")

        cur.close()
        conn.close()

        print("\n" + "="*60)
        print("CEO Agent system ready for orchestration!")
        print("="*60 + "\n")

        return True

    except Exception as e:
        print(f"\n  ERROR: Migration failed: {e}")
        return False

if __name__ == '__main__':
    run_migration()
