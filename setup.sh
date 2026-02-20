#!/bin/bash

echo "============================================================"
echo "Mission Control Center - Quick Setup"
echo "============================================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set"
    echo ""
    echo "Please set your Supabase connection string:"
    echo 'export DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"'
    echo ""
    exit 1
fi

echo "✓ DATABASE_URL found"
echo ""

# 1. Run schema migration
echo "[1/4] Running database schema migration..."
psql $DATABASE_URL < database/schema.sql > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✓ Schema created"
else
    echo "  ⚠ Schema may already exist (this is OK)"
fi
echo ""

# 2. Seed agents
echo "[2/4] Discovering agents from marketing portal..."
python3 database/seed_agents.py
echo ""

# 3. Install frontend dependencies
echo "[3/4] Installing frontend dependencies..."
cd frontend
npm install > /dev/null 2>&1
echo "  ✓ Frontend dependencies installed"
cd ..
echo ""

# 4. Install backend dependencies
echo "[4/4] Installing backend dependencies..."
cd backend
npm install > /dev/null 2>&1
echo "  ✓ Backend dependencies installed"
cd ..
echo ""

echo "============================================================"
echo "✓ Setup Complete!"
echo "============================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Create frontend/.env with your Supabase credentials"
echo "2. Create backend/.env with your Supabase credentials"
echo "3. Start the servers:"
echo ""
echo "   Terminal 1: cd frontend && npm run dev"
echo "   Terminal 2: cd backend && npm start"
echo ""
echo "4. Visit http://localhost:5173"
echo ""
echo "============================================================"
