# Running on Windows (Without Docker)

This guide covers running GAH IT Inventory as a background process on a Windows server or PC using PM2.

---

## Prerequisites

- **[Node.js v20+](https://nodejs.org/)** — During installation, check **"Automatically install the necessary tools"** when prompted. This installs Python and Visual Studio Build Tools, which are required to compile the SQLite native module.
- **[Git](https://git-scm.com/download/win)** — To clone and update the repository.
- **[PM2](https://pm2.keymetrics.io/)** — To run the app as a persistent background process.

> **Important:** Do not install the app under `C:\Program Files\`. Windows restricts writes to that directory and will cause install errors. Use a path your user account owns, such as `C:\InventoryApp\`.

---

## First-Time Setup

### 1. Clone the repository

```powershell
git clone https://github.com/RADavis03/InventoryApp.git C:\InventoryApp
cd C:\InventoryApp
```

### 2. Install dependencies

```powershell
npm run install:all
```

This installs packages for the root, server, and client. `better-sqlite3` will compile its native module automatically — this requires the build tools installed in the prerequisite step.

### 3. Build the frontend

```powershell
npm run build
```

This compiles the React app into `client\dist\`, which the Express server will serve in production.

### 4. Install PM2 globally

```powershell
npm install -g pm2
```

### 5. Start the app

```powershell
cd C:\InventoryApp
$env:NODE_ENV="production"; pm2 start server\index.js --name inventory
```

The app will be available at **http://localhost:3001**

### 6. Save the PM2 process list

```powershell
pm2 save
```

This persists the process list so you can restore it after a reboot.

---

## Auto-Start on Reboot

PM2 does not auto-start on Windows reboot by default. The easiest way to handle this is a scheduled task.

### Create a startup script

Create a file `C:\InventoryApp\start-inventory.ps1`:

```powershell
$env:NODE_ENV="production"
pm2 start C:\InventoryApp\server\index.js --name inventory
```

### Register it as a scheduled task (run as Administrator)

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\InventoryApp\start-inventory.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0
Register-ScheduledTask -TaskName "InventoryApp" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force
```

---

## Managing the App

```powershell
pm2 status               # show running processes
pm2 logs inventory       # view live logs
pm2 stop inventory       # stop the app
pm2 restart inventory    # restart the app
pm2 delete inventory     # remove from PM2
```

---

## Updating After a Code Change

```powershell
cd C:\InventoryApp
git pull
npm run install:all      # only needed if dependencies changed
npm run build
pm2 restart inventory
```

---

## Data

The SQLite database is created automatically at `C:\InventoryApp\data\inventory.db` on first run. Back up this file to preserve your data.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `EPERM` errors during install | App is in `C:\Program Files\` | Move to `C:\InventoryApp\` |
| `better-sqlite3` build fails | Missing build tools or incompatible Node version | Re-run Node installer and check "Automatically install necessary tools" |
| `Cannot GET /` in browser | `NODE_ENV` not set to `production` | Stop PM2 process and restart with `$env:NODE_ENV="production"` set |
| App not running after reboot | PM2 startup not configured | Follow the Auto-Start on Reboot section above |
