@echo off
cd /d "%~dp0.."
call node __tests__\_qa_phase.mjs p6a > __tests__\p6a.log 2>&1
call node __tests__\_qa_phase.mjs p6b > __tests__\p6b.log 2>&1
call node __tests__\_qa_phase.mjs p6c > __tests__\p6c.log 2>&1
echo BATCH_DONE