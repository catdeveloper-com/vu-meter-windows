// main.js
const {app, BrowserWindow, session, desktopCapturer} = require('electron');
const path = require('path');

async function chooseFirstScreen(request, callback) {
    // Получаем список экранов
    const sources = await desktopCapturer.getSources({
        types: ['screen'],       // только экраны
        audio: true,             // loopback-аудио
        thumbnailSize: {width: 0, height: 0},
        fetchWindowIcons: false
    });
    if (sources.length > 0) {
        // Даем браузеру выбранный источник для audio + video
        callback({audio: 'loopback', video: sources[0]});
    } else {
        callback({audio: false, video: false});
    }
}

app.whenReady().then(() => {
    // Перехватываем все getDisplayMedia-запросы
    session.defaultSession.setDisplayMediaRequestHandler(
        chooseFirstScreen,
        {useSystemPicker: false}  // без системного UI, сразу в колбэке
    );

    const win = new BrowserWindow({
        width: 900,
        height: 550,
        minWidth: 320,    // минимальная ширина
        minHeight: 500,
        backgroundColor: '#262421',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    win.setMenuBarVisibility(false);
    win.loadFile(path.join(__dirname, 'public/index.html'));
});
app.on('window-all-closed', () => app.quit());
