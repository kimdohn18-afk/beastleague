name: KBO Data Collector

on:
  schedule:
    - cron: '0 14 * * *'  # 매일 KST 23:00
  workflow_dispatch:
    inputs:
      date:
        description: '날짜 (YYYYMMDD)'
        required: false
        default: ''

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: pip install -r collector/requirements.txt

      - name: Run KBO Collector
        working-directory: collector
        env:
          API_URL: ${{ secrets.API_URL }}
          INTERNAL_API_KEY: ${{ secrets.INTERNAL_API_KEY }}
        run: |
          if [ -n "${{ github.event.inputs.date }}" ]; then
            python kbo_collector.py ${{ github.event.inputs.date }}
          else
            python kbo_collector.py
          fi
