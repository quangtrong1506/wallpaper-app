const {
    app,
    BrowserWindow,
    screen,
    Tray,
    Menu,
    shell,
    powerMonitor,
    Notification,
    ipcMain,
    globalShortcut,
} = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const isDev = require('electron-is-dev');

// biến toàn cục
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let tray = null,
    mainWindow = null,
    heightScreen,
    widthScreen;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        title: 'Live Wallpaper',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: true,
            enableRemoteModule: false,
        },
        minimizable: false,
        resizable: true,
        frame: false,
        x: 0,
        y: 0,
        icon: path.join(__dirname, './src/images/logo.ico'),
    });
    mainWindow.loadFile('index.html');
    mainWindow.blur();
    mainWindow.removeMenu();
    mainWindow.maximize();
    mainWindow.setSkipTaskbar(true);
    if (isDev) mainWindow.webContents.openDevTools();
    if (isDev) tray = new Tray('./src/images/logo.ico');
    else tray = new Tray('resources/images/logo.ico');
    let contextMenu = Menu.buildFromTemplate(trayMenu());
    tray.setContextMenu(contextMenu);
    tray.setToolTip('Màn hình nền');
    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        mainWindow.blur();
    });
    mainWindow.webContents.setWindowOpenHandler((link) => {
        if (link.url.match('https://youtube.com'))
            return createNewWindow(link.url, 'resources/images/youtube.ico');
        return shell.openExternal(link.url);
    });
}

const singleInstanceLock = app.requestSingleInstanceLock();
app.whenReady().then(() => {
    ipcMain.on('set-notification', getNotificationInPreload);
    ipcMain.on('quit-app', () => {
        app.quit();
    });
    ipcMain.on('confirm-relaunch', () => {
        app.relaunch();
        app.exit();
    });

    createWindow();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    widthScreen = width;
    heightScreen = height;
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    if (process.platform === 'win32') app.setAppUserModelId(app.name);
    if (!singleInstanceLock) app.quit();
    else
        app.on('second-instance', () => {
            app.focus();
        });

    powerMonitor.on('lock-screen', () => {
        mainWindow.webContents.send('lock-screen', true);
    });
    powerMonitor.on('unlock-screen', () => {
        mainWindow.webContents.send('lock-screen', false);
    });
    autoUpdater.checkForUpdates();
    setInterval(() => autoUpdater.checkForUpdates(), 5 * 60 * 1000);
});
if (!isDev)
    app.setLoginItemSettings({
        openAtLogin: true,
    });

/*New Update Available*/
autoUpdater.on('update-available', (info) => {
    sendLog(`Update available. Current version ${app.getVersion()}`);
    autoUpdater.downloadUpdate();
});

/*Download Completion Message*/

autoUpdater.on('error', (info) => {
    sendLog(info, 'error');
});
autoUpdater.on('update-downloaded', () => {
    showNotification(null, {
        title: 'Cập nhật thành công',
        body: 'Khởi động lại ứng dụng để áp dụng các bản cập nhật',
        isUpdated: true,
    });
});

function getNotificationInPreload(event, options) {
    showNotification(options);
}
function showNotification(options) {
    var notification = new Notification({
        title: options.title,
        body: options.body,
        timeoutType: 'default',
        icon: 'resources/images/logo.ico',
        actions: [],
    });
    notification.show();
    if (options.isUpdated) {
        notification.on('click', () => {
            mainWindow.webContents.send('relaunch-app', true);
        });
        notification.on('close', () => {
            mainWindow.webContents.send('relaunch-app', true);
        });
    }
}

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

function trayMenu() {
    let innerMenu = [
        {
            label: 'Dừng',
            click: () => {
                app.quit();
            },
        },
        {
            label: 'Open devtool',
            click: () => {
                mainWindow.webContents.openDevTools();
            },
        },
        {
            label: 'Liên hệ',
            click: () => {
                shell.openExternal('https://www.facebook.com/quangtrong.1506');
            },
        },
    ];
    return innerMenu;
}

// Mở cửa sổ mới
function createNewWindow(url, icon = 'resources/images/logo.ico') {
    win = new BrowserWindow({
        width: widthScreen,
        height: heightScreen,
        resizable: true,
        frame: true,
        x: 0,
        y: 0,
        icon: icon,
    });

    // and load the link of the app.
    win.loadURL(url);
    //xóa menu mặc định
    win.removeMenu();
    // Max size
    win.maximize();
    win.webContents.on('new-window', function (e, url) {
        e.preventDefault();
        shell.openExternal(url);
    });
}

function sendLog(message, type) {
    mainWindow.webContents.send('debug', { message: message, type: type });
}
process.on('uncaughtException', function (err) {
    sendLog(err, 'error');
});
