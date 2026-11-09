@echo off
setlocal
cd /d "%~dp0"

echo ======================================================================
echo    FinNexus Insurance Engine - Business Data Reset
echo ======================================================================

set PYTHON_EXE=backend\.venv\Scripts\python.exe
if not exist "%PYTHON_EXE%" (
    set PYTHON_EXE=python
)

"%PYTHON_EXE%" backend\scripts\reset_insurance_business_data.py %*

endlocal
