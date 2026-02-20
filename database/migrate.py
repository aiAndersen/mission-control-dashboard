#!/usr/bin/env python3
"""Run database migration from schema.sql"""
import os
import sys
import psycopg2

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

print("Running database migration...")

# Read schema
with open('database/schema.sql', 'r') as f:
    schema = f.read()

# Execute
try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute(schema)
    conn.commit()
    cur.close()
    conn.close()
    print("✓ Schema migration complete!")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
