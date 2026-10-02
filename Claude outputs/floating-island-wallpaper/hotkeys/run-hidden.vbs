' Runs FloatingIsland-Hotkey.ps1 with no console window flashing up.
' Usage (from the shortcuts): wscript.exe run-hidden.vbs Toggle|Pause
Dim shell, fso, here, action
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
action = "Toggle"
If WScript.Arguments.Count > 0 Then action = WScript.Arguments(0)
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & here & "\FloatingIsland-Hotkey.ps1"" -Action " & action, 0, False
