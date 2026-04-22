# App Launch Instructions

## Prerequisites

- Windows 10 or later
- PowerShell 5.1 or later (pre-installed on modern Windows)

## Step 1 — Enable Script Execution

PowerShell blocks scripts by default. You need to allow them before running the setup.

1. Open **PowerShell as Administrator**
   - Press `Win + S`, type **PowerShell**
   - Right-click **Windows PowerShell** and select **Run as administrator**

2. Run the following command:

   ```powershell
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

3. When prompted, type **Y** and press Enter to confirm.

> **Note:** If you prefer not to change the policy permanently, you can skip this step and use the bypass method described in the Troubleshooting section below.

## Step 2 — Navigate to the App Folder

In PowerShell, navigate to the directory where the app files are located:

```powershell
cd "C:\path\to\your\app"
```

Replace `C:\path\to\your\app` with the actual path to the folder containing `window_setup.ps1`.

## Step 3 — Run the Setup Script

Execute the setup script:

```powershell
.\windows_setup.ps1
```

The app window should now launch.

## Troubleshooting

### "Running scripts is disabled on this system"

If you see this error and don't want to change the execution policy globally, run the script with a one-time bypass:

```powershell
powershell -ExecutionPolicy Bypass -File .\windows_setup.ps1
```

### "window_setup.ps1 is not recognized"

Make sure you are in the correct directory. Verify the file exists:

```powershell
Get-ChildItem .\windows_setup.ps1
```

### Errors while running the script

Try running the script again and if it does not work contact the TAs during the office hours.

### Clean Up

Three programs were on the PC in order to run this project

1. Ollama
To delete ollama run the following command
```powershell
winget uninstall Ollama.Ollama
```

2. NodeJS
To delete NodeJS run the following command
```powershell
winget uninstall OpenJS.NodeJS
```

The dependencies from node js are found in the frontend/node_modules folder. 
To remove them just delete the folder.

3. Python
To delete python run the following command (not recomanded since python is used in many other ETH courses)
```powershell
winget uninstall Python.Python.3.12
```