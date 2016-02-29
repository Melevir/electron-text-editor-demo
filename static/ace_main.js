const remote = require('electron').remote,
    Menu = remote.Menu,
    MenuItem = remote.MenuItem,
    AceRange = ace.require('ace/range').Range,
    dialog = remote.require('dialog'),
    fs = require('fs');
var highlitedMarkersIds = [],
    editor = null,
    menu = null,
    openedFileName = null;


var setupEditor = function () {
        var editor = ace.edit("editor");
        editor.setTheme("ace/theme/monokai");
        editor.$blockScrolling = Infinity;
        editor.getSession().setMode("ace/mode/markdown");
        editor.getSession().setUseWrapMode(true);

        editor.on('change', function(){
            checkWithGlvrd(editor);
        });
        editor.commands.addCommand({
            name: "glvrd",
            bindKey: {win: "Ctrl-G", mac: "Command-G"},
            exec: function(editor) {
                checkWithGlvrd(editor);

            }
        });

        return editor;
    },
    checkWithGlvrd = function (editor) {
        glvrd.getStatus(function (d) {
            if (d.status == 'ok') {
                var document = editor.getSession().getDocument(),
                    annotations = [];
                glvrd.proofread(editor.getValue(), function (data) {
                    _.each(highlitedMarkersIds, function (markerId) {
                        editor.getSession().removeMarker(markerId);
                    });
                    highlitedMarkersIds = []
                    _.each(data.fragments, function (fragment) {
                        var startIndex = fragment.start,
                            endIndex = fragment.end,
                            start = null,
                            end = null;
                        start = document.indexToPosition(startIndex, 0);
                        end = document.indexToPosition(endIndex, 0);
                        highlitedMarkersIds.push(editor.getSession().addMarker(
                                new AceRange(start.row, start.column, end.row, end.column),
                                "misspelled",
                                "typo",
                                true
                        ));
                        annotations.push({
                            row: start.row,
                            column: start.column,
                            text: fragment.hint.name + '\n\t' + fragment.hint.description,
                            type: "warning"
                        });
                    });
                    editor.getSession().setAnnotations(annotations);
                })
            }
        });
    },
    saveTextAs = function () {
        dialog.showSaveDialog({ filters: [
            { name: 'Markdown', extensions: ['md'] }
        ]}, function (fileName) {
            if (fileName === undefined) return;
            openedFileName = fileName;
            fs.writeFile(fileName, editor.getValue());
            updateLastOpenedFiles(openedFileName);
        });
    },
    getLastOpenedFiles = function () {
        var rawList = localStorage['lastOpenedFiles'];
        if (rawList === undefined) {
            return [];
        }
        return JSON.parse(rawList);
    },
    updateLastOpenedFiles = function (filePath) {
        var currentList = getLastOpenedFiles();
        if (currentList.indexOf(filePath) > -1) {
            return;
        }
        currentList.push(filePath);
        localStorage.setItem('lastOpenedFiles', JSON.stringify(currentList));
    },
    openFile = function (editor, fileName) {
        openedFileName = fileName;
        fs.readFile(fileName, 'utf-8', function (err, data) {
            editor.setValue(data, -1);
            updateLastOpenedFiles(fileName);
        });
    },
    buildMenu = function (editor) {
        var template = [
            {label: 'electron'},
            {
                label: 'File',
                submenu: [
                    {
                        label: 'Open',
                        accelerator: 'CmdOrCtrl+O',
                        click: function(item, focusedWindow) {
                            dialog.showOpenDialog({ filters: [
                                { name: 'Markdown', extensions: ['md'] }
                            ]}, function (fileNames) {
                                if (fileNames === undefined) return;
                                openFile(editor, fileNames[0]);
                            });
                        }
                    },
                    {
                        label: 'Save',
                        accelerator: 'CmdOrCtrl+S',
                        click: function(item, focusedWindow) {
                            if (openedFileName === null) {
                                saveTextAs();
                            };
                            fs.writeFile(openedFileName, editor.getValue());
                        },
                    },
                    {
                        label: 'Save as...',
                        accelerator: 'Shift+CmdOrCtrl+S',
                        click: function(item, focusedWindow) {
                            saveTextAs();
                        },
                    }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    {
                        label: 'Undo',
                        accelerator: 'CmdOrCtrl+Z',
                        role: 'undo'
                    },
                    {
                        label: 'Redo',
                        accelerator: 'Shift+CmdOrCtrl+Z',
                        role: 'redo'
                    },
                    {
                        type: 'separator'
                    },
                    {
                        label: 'Cut',
                        accelerator: 'CmdOrCtrl+X',
                        role: 'cut',
                    },
                    {
                        label: 'Copy',
                        accelerator: 'CmdOrCtrl+C',
                        role: 'copy'
                    },
                    {
                        label: 'Paste',
                        accelerator: 'CmdOrCtrl+V',
                        role: 'paste'
                    },
                    {
                        label: 'Select All',
                        accelerator: 'CmdOrCtrl+A',
                        role: 'selectall'
                    },
                ]
            },
            {
                label: 'Tools',
                submenu: [
                    {
                        label: 'Check with Glvrd',
                        accelerator: 'CmdOrCtrl+G',
                        click: function(item, focusedWindow) {
                            checkWithGlvrd(editor);
                        }
                    }
                ]
            },
            {
                label: 'View',
                submenu: [
                    {
                        label: 'Toggle Full Screen',
                        accelerator: (function() {
                            if (process.platform == 'darwin')
                                return 'Ctrl+Command+F';
                            else
                                return 'F11';
                            })(),
                        click: function(item, focusedWindow) {
                            if (focusedWindow)
                                focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
                        }
                    },
                    {
                        label: 'Toggle Developer Tools',
                        accelerator: (function() {
                            if (process.platform == 'darwin')
                                return 'Alt+Command+I';
                            else
                                return 'Ctrl+Shift+I';
                        })(),
                        click: function(item, focusedWindow) {
                            if (focusedWindow)
                                focusedWindow.toggleDevTools();
                        }
                    }
                ]
            }
        ];
        // добавление информации о последних открытых файлах
        var lastOpenedFiles = getLastOpenedFiles();
        if (lastOpenedFiles) {
            template[1].submenu.push({
                type: 'separator'
            });
        }
        _.each(lastOpenedFiles, function (filePath) {
            var fileParts = filePath.split('/');
            template[1].submenu.push({  // File menu
                label: fileParts[fileParts.length - 1],
                click: function () { openFile(editor, filePath); }
            });
        });
        menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    };


editor = setupEditor();
buildMenu(editor);
checkWithGlvrd(editor);
