#!/bin/bash
# Easy benchmark runner script

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}          Custom Benchmark Suite Runner                    ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check if .env exists
if [ ! -f "../../.env" ]; then
    echo -e "${YELLOW}Warning: .env file not found in project root${NC}"
    echo "You may need to set GOOGLE_GENERATIVE_AI_API_KEY"
    echo ""
fi

# Default values
CATEGORY="all"
DIFFICULTY=""
LIMIT=""
WORKSPACE=$(pwd)/../..
OUTPUT="benchmark-results-$(date +%Y%m%d-%H%M%S).json"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --category=*)
            CATEGORY="${1#*=}"
            shift
            ;;
        --difficulty=*)
            DIFFICULTY="--difficulty=${1#*=}"
            shift
            ;;
        --limit=*)
            LIMIT="--limit=${1#*=}"
            shift
            ;;
        --workspace=*)
            WORKSPACE="${1#*=}"
            shift
            ;;
        --output=*)
            OUTPUT="${1#*=}"
            shift
            ;;
        --quick)
            # Quick run: only easy tasks, limit 2 per category
            DIFFICULTY="--difficulty=easy"
            LIMIT="--limit=2"
            echo -e "${GREEN}Quick mode: Running only 2 easy tasks per category${NC}"
            echo ""
            shift
            ;;
        --help)
            echo "Usage: ./run-benchmarks.sh [options]"
            echo ""
            echo "Options:"
            echo "  --category=<name>     Run specific category (reasoning|coding|tool-use|codebase-comprehension|bug-fixing|multi-step-planning|all)"
            echo "  --difficulty=<level>  Filter by difficulty (easy|medium|hard)"
            echo "  --limit=<number>      Limit tasks per category"
            echo "  --workspace=<path>    Workspace root (default: project root)"
            echo "  --output=<file>       Output file for results (default: timestamped JSON)"
            echo "  --quick               Quick test: 2 easy tasks per category"
            echo "  --help                Show this help"
            echo ""
            echo "Examples:"
            echo "  ./run-benchmarks.sh --quick"
            echo "  ./run-benchmarks.sh --category=reasoning --difficulty=easy"
            echo "  ./run-benchmarks.sh --category=coding --limit=3"
            echo "  ./run-benchmarks.sh --category=all --output=my-results.json"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build if needed
if [ ! -f "dist/custom-runner.js" ]; then
    echo -e "${YELLOW}Building benchmarks package...${NC}"
    npm run build
    echo ""
fi

# Run benchmarks
echo -e "${GREEN}Running benchmarks...${NC}"
echo "Category: $CATEGORY"
if [ -n "$DIFFICULTY" ]; then
    echo "Difficulty: ${DIFFICULTY#*=}"
fi
if [ -n "$LIMIT" ]; then
    echo "Limit: ${LIMIT#*=}"
fi
echo "Output: $OUTPUT"
echo ""

# Execute with increased heap size to handle memory extraction + RAG indexing
node --max-old-space-size=8192 dist/custom-runner.js $CATEGORY $DIFFICULTY $LIMIT --workspace=$WORKSPACE --output=$OUTPUT

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Benchmarks complete! Results saved to: $OUTPUT${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "View results:"
echo "  cat $OUTPUT | jq '.summary'"
echo "  cat $OUTPUT | jq '.summary.byCategory'"
echo "  cat $OUTPUT | jq '.summary.byDifficulty'"
