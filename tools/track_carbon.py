"""Run a command under CodeCarbon and write emissions to emissions.csv.

Usage: python3 tools/track_carbon.py [command ...]
Default command: npm start
Install: pip install codecarbon
"""
import signal
import subprocess
import sys

from codecarbon import EmissionsTracker

cmd = sys.argv[1:] or ["npm", "start"]
tracker = EmissionsTracker(project_name="grounded", output_dir=".", log_level="warning")
tracker.start()
proc = subprocess.Popen(cmd)
try:
    proc.wait()
except KeyboardInterrupt:
    proc.send_signal(signal.SIGINT)
    proc.wait()
finally:
    kg = tracker.stop()
    print(f"\nEmissions: {kg:.6f} kg CO2eq (details in emissions.csv)")
