
import sys
import os
from pathlib import Path
import json
import asyncio

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from agents.code_analyzer import CodeAnalyzerAgent

async def debug_analysis():
    # Use the latest cloned path
    project_path = Path("C:/tmp/servergem_repos/confirmit-fastapi-server_20260117_193210")
    
    # Initialize agent (no need for real keys for heuristic/static test)
    agent = CodeAnalyzerAgent(gcloud_project="test-project")
    
    print(f"--- Debugging Analysis for {project_path} ---")
    
    # 1. Test Scanning
    print("\n[1] Scanning directory...")
    file_structure = agent._scan_directory(project_path)
    print(f"Metrics: {json.dumps(file_structure['metrics'], indent=2)}")
    print(f"Config Files: {file_structure['config_files']}")
    
    # 2. Test Heuristics
    print("\n[2] Running heuristics...")
    heuristic = agent._heuristic_analysis(project_path, file_structure)
    print(f"Heuristic Report: {json.dumps(heuristic, indent=2)}")
    
    # 3. Test Fallback (AI simulation)
    print("\n[3] Running fallback analysis...")
    fallback = agent._fallback_analysis(project_path, file_structure, heuristic)
    print(f"Fallback Report: {json.dumps(fallback, indent=2)}")
    
    # 4. Prompt Preview
    print("\n[4] Analysis Prompt Preview:")
    prompt = agent._build_analysis_prompt(file_structure, project_path, heuristic)
    print("-" * 40)
    print(prompt[:1000] + "...")
    print("-" * 40)

if __name__ == "__main__":
    asyncio.run(debug_analysis())
