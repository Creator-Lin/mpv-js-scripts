var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
/**
 * This script will take a screenshot of a video and create a mosaic of that said video.
 * It will take a screenshot of determined number of rows and columns, and then create
 * a montage of those screenshots.
 *
 * This .js file is a compiled version of the .ts file, you can compile it yourself by
 * running `npm run compile:mosaic`.
 *
 * Originally Created by: N4O#8868 (noaione)
 * Translated and Modified by: Creator-Lin
 * 
 * License: MIT
 */
var mosaicOptions = {
    // Number of rows for screenshot
    rows: 3,
    // Number of columns for screenshot
    columns: 4,
    // Padding between screenshots (pixels)
    padding: 10,
    // Output format
    /**
     * @type {"png" | "jpg" | "webp"}
     */
    format: "png",
    // Screenshot mode
    /**
     * @type {"video" | "subtitles" | "window"}
     */
    mode: "video",
    // Append the "magick" command to the command line.
    // Sometimes on windows, you cannot really use any magick command without prefixing
    // "magick", if the command failed, you can set this to `yes` in your config.
    append_magick: "yes",
    // Resize the final montage into the video height.
    // I recommend keeping this enabled since if you have a 4k video, you don't want to
    // have a montage that is basically 4k * whatever the number of screenshots you have.
    // It would be way too big, so this will resize it back to the video height.
    resize: "yes",
    // The quality of the final montage image.
    quality: 90
};
/**
 * The result of running a subprocess.
 * @typedef {Object} SubprocessResult
 * @property {string | undefined} stdout - The stdout of the command.
 * @property {string | undefined} stderr - The stderr of the command.
 * @property {number} status - The exit code of the command.
 * @property {boolean} killed_by_us - Whether the command was killed by us.
 * @property {string} error_string - The error string of the command.
 */
/**
 * The callback chain for montage -> resize -> annotate
 * @callback CallbackChain
 * @param {boolean} success - Whether the command was successful.
 * @param {string | undefined} error - The error string of the command.
 */
/**
 * @class Pathing
 */
var Pathing = /** @class */ (function () {
    function Pathing() {
        this._isUnix = null;
        this._isMac = null;
        this._pathSep = null;
    }
    Pathing.prototype.getCwd = function () {
        var cwd = mp.utils.getcwd();
        if (cwd)
            return cwd;
        return "";
    };
    Pathing.prototype._detectOs = function () {
        var cwdPath = this.getCwd();
        this._isUnix = cwdPath.charAt(0) === '/';
        this._isMac = false; // Mac is also Unix, but we'll detect separately.
        this._pathSep = this._isUnix ? '/' : '\\';
        if (this._isUnix) {
            var unameResult = mp.command_native_async({ name: "subprocess", capture_stdout: true, playback_only: false, args: ["uname", "-s"] });
            if (typeof unameResult.stdout === "string" && unameResult.stdout.match(/^\s*Darwin\s*$/)) {
                this._isMac = true;
            }
        }
    };
    Pathing.prototype.isUnix = function () {
        if (this._isUnix === null) {
            this._detectOs();
        }
        return this._isUnix;
    };
    Pathing.prototype.isMac = function () {
        if (this._isMac === null) {
            this._detectOs();
        }
        return this._isMac;
    };
    Pathing.prototype.pathSep = function () {
        if (this._pathSep === null) {
            this._detectOs();
        }
        return this._pathSep;
    };
    Pathing.prototype.getParentPath = function (path) {
        if (this._isUnix === null || this._pathSep === null) {
            this._detectOs();
        }
        var pathParts = path.split(this._pathSep);
        var previousDir = null;
        if (pathParts.length > 1) {
            previousDir = pathParts.pop();
        }
        var newPath = pathParts.join(this._pathSep);
        if (this._isUnix && !newPath.length) {
            newPath = "/";
        }
        if (!newPath.length) {
            newPath = path;
        }
        return {
            path: path,
            newPath: newPath,
            previousDir: previousDir
        };
    };
    Pathing.prototype.createDirectory = function (path) {
        if (this.isUnix()) {
            mp.msg.info("Creating directory (Unix): " + path);
            mp.command_native({ name: "subprocess", playback_only: false, args: ["mkdir", "-p", path] });
        }
        else {
            mp.msg.info("Creating directory (Windows): " + path);
            mp.command_native({ name: "subprocess", playback_only: false, args: ["cmd", "/C", "mkdir ".concat(path)] });
        }
    };
    Pathing.prototype.deleteFile = function (path) {
        mp.msg.info("Deleting file: " + path);
        if (this.isUnix()) {
            mp.command_native({ name: "subprocess", playback_only: false, args: ["rm", path] });
        }
        else {
            mp.command_native({ name: "subprocess", playback_only: false, args: ["cmd", "/C", "del /F /Q ".concat(path)] });
        }
    };
    Pathing.prototype.joinPath = function (basePath, path) {
        if (this._pathSep === null) {
            this._detectOs();
        }
        return basePath + this._pathSep + path;
    };
    Pathing.prototype.fixPath = function (path) {
        if (!this.isUnix()) {
            if (path.indexOf("/")) {
                path = path.replace(/\//g, "\\");
            }
            if (path.indexOf("Program Files (x86)")) {
                path = path.replace("Program Files (x86)", "PROGRA~2");
            }
            if (path.indexOf("Program Files")) {
                path = path.replace("Program Files", "PROGRA~1");
            }
        }
        return path;
    };
    return Pathing;
}());
mp.options.read_options(mosaicOptions, "screenshot-mosaic");
/**
 * Test if a directory is valid.
 * @param {string} path - The path to test.
 * @returns {boolean} - Whether the path is valid.
 */
function testDirectory(path) {
    var paths = new Pathing();
    var target = mp.utils.join_path(path, "_mosaic_screenshot_test.bin");
    try {
        mp.utils.write_file("file://".concat(target), "THIS FILE IS CREATED BY MPV SCREENSHOT MOSAIC SCRIPT");
    }
    catch (e) {
        mp.msg.error("Could not write to directory: " + path);
        return false;
    }
    // delete
    paths.deleteFile(paths.fixPath(target));
    return true;
}
/**
 * Get the output directory.
 * @returns {string} - The output directory.
 */
function getOutputDir() {
    var paths = new Pathing();
    // Use screenshot directory
    var screenDir = mp.get_property("screenshot-directory");
    if (screenDir) {
        var expandScreenDir = mp.command_native(["expand-path", screenDir]);
        var lastError = mp.last_error();
        if (!lastError && testDirectory(expandScreenDir)) {
            mp.msg.info("Using screenshot directory: " + expandScreenDir);
            return paths.fixPath(expandScreenDir);
        }
    }
    // Use mpv home directory as fallback
    var desktopDir = mp.command_native(["expand-path", "~~desktop/"]);
    mp.msg.error("Could not get screenshot directory, trying to use desktop directory: ".concat(desktopDir));
    return paths.fixPath(desktopDir);
}
/**
 * Explicitly check if the execution of magick command was successful.
 * Since sometimes a command would just return 0 even if it failed.
 * @param {SubprocessResult} result - The result of the subprocess.
 * @returns {boolean} - Whether the subprocess was successful.
 */
function isMagickSuccess(result) {
    // mpv subprocess actually return success even if magick fails.
    if (result.status !== 0) {
        return [false, result.stderr || ""];
    }
    var stdout = result.stdout || "";
    var stderr = result.stderr || "";
    var errorMsg = (stdout || stderr).replace(/\r?\n/g, "\n");
    return [stdout.indexOf("error/") === -1 && stderr.indexOf("error/") === -1, errorMsg];
}
/**
 * Humanize bytes number to a human readable string.
 * @param {number | undefined} bytes - The number of bytes.
 * @returns {string} - The humanized bytes. e.g. "1.2 MiB" or "?? B" if bytes is undefined.
 */
function humanizeBytes(bytes) {
    if (bytes === undefined)
        return "?? B";
    var thresh = 1024;
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units = ['kiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
}
/**
 * Floor a number.
 * Since there is no Math.floor in mpv scripting, use ~~ instead.
 * @param {number} n - The number to floor.
 * @returns {number} - The floored number.
 */
function floor(n) {
    // no Math module
    return ~~n;
}
/**
 * Pad a number with leading zeros.
 * @param {number} n - The number to pad.
 * @returns {string}
 */
function padZero(n) {
    return n < 10 ? "0" + n : "" + n;
}
/**
 * Format a duration number into HH:MM:SS.
 * @param {number | undefined} seconds - The seconds to format.
 * @returns {string} - The formatted duration.
 */
function formatDurationToHHMMSS(seconds) {
    // do not use Date
    if (seconds === undefined)
        return "??:??:??";
    var hours = floor(seconds / 3600);
    var minutes = floor((seconds - (hours * 3600)) / 60);
    var seconds2 = floor(seconds - (hours * 3600) - (minutes * 60));
    // pad numbers with leading zeros
    var hoursString = padZero(hours);
    var minutesString = padZero(minutes);
    var secondsString = padZero(seconds2);
    return hoursString + ":" + minutesString + ":" + secondsString;
}
/**
 * Format an output filename with some constraints and extra info.
 * @param {string} fileName - The original filename
 * @returns {string} - The new filename
 */
function createOutputName(fileName) {
    var finalName = fileName.replace(" ", "_");
    var ColRow = "".concat(mosaicOptions.columns, "x").concat(mosaicOptions.rows);
    var mosaicName = ".mosaic".concat(ColRow);
    // Max count is 256 characters, with safety margin to 224
    var testCount = finalName.length + mosaicName.length;
    if (testCount > 224) {
        // Butcher only the finalName that doesn't include the mosaicName yet
        var cutCount = testCount - 224;
        finalName = finalName.slice(0, -cutCount);
    }
    return finalName + mosaicName;
}
/**
 * Run the resize command, will be skipped if resize is disabled.
 * @param {string} imgOutput - The image output path.
 * @param {number} videoHeight - The video height.
 * @param {CallbackChain} callback - The callback chain that will be called.
 * @returns {void} - Nothing
 */
function runResize(imgOutput, videoHeight, callback) {
    var resizeCmdsBase = [];
    if (mosaicOptions.append_magick.toLowerCase() === "yes") {
        resizeCmdsBase.push("magick");
    }
    var resizeCmds = __spreadArray(__spreadArray([], resizeCmdsBase, true), [
        "convert",
        "".concat(imgOutput, ".montage.png"),
        "-resize",
        "x".concat(videoHeight),
        "".concat(imgOutput, ".montage.png"),
    ], false);
    if (mosaicOptions.resize.toLowerCase() !== "yes") {
        callback(true, undefined);
        return;
    }
    mp.msg.info("Resizing image to x".concat(videoHeight, ": ").concat(imgOutput, ".montage.png"));
    dump(resizeCmds);
    mp.command_native_async({
        name: "subprocess",
        playback_only: false,
        args: resizeCmds,
        capture_stderr: true,
        capture_stdout: true
    }, function (_, result, __) {
        var _a = isMagickSuccess(result), success = _a[0], errorMsg = _a[1];
        mp.msg.info("Resize status: ".concat(success, " || err? ").concat(errorMsg));
        callback(success, errorMsg);
    });
}
/**
 * Run the annotation command.
 * @param {string} fileName - The video filename.
 * @param {number} videoWidth - The video width.
 * @param {number} videoHeight - The video height.
 * @param {string} duration - The video duration (pre-formatted).
 * @param {string} imgOutput - The image output path.
 * @param {CallbackChain} callback - The callback chain that will be called.
 * @returns {void} - Nothing
 */
function runAnnotation(fileName, videoWidth, videoHeight, duration, imgOutput, callback) {
    // annotate text
    var annotateCmdsBase = [];
    if (mosaicOptions.append_magick.toLowerCase() === "yes") {
        annotateCmdsBase.push("magick");
    }
    var annotateCmds = __spreadArray(__spreadArray([], annotateCmdsBase, true), [
        "convert",
        "-background",
        "white",
        "-font",
        "华文宋体",
        "-pointsize",
        "40",
        "label:MPV Media Player",
        "-gravity",
        "northwest",
        // Add top margin
        "-splice",
        "0x10",
        "-pointsize",
        "20",
        "label:文件名: " + fileName + "" +
        "              文件大小: " + humanizeBytes(mp.get_property_number("file-size")) + "" +
        "              视频分辨率: " + videoWidth + "x" + videoHeight + "" +
        "              视频时长: " + duration + "",
        "-gravity",
        "northwest",
        // Add left margin
        "-splice",
        "20x0",
        "".concat(imgOutput, ".montage.png"),
        "-append",
        "-quality",
        "".concat(mosaicOptions.quality, "%"),
        imgOutput,
    ], false);
    mp.msg.info("Annotating image: ".concat(imgOutput));
    dump(annotateCmds);
    mp.command_native_async({
        name: "subprocess",
        playback_only: false,
        args: annotateCmds,
        capture_stderr: true,
        capture_stdout: true
    }, function (_, result, __) {
        var _a = isMagickSuccess(result), success = _a[0], errorMsg = _a[1];
        mp.msg.info("Annotate status: ".concat(success, " || err? ").concat(errorMsg));
        callback(success, errorMsg);
    });
}
/**
 * Run the montagge, resize, and annotate command.
 * @param {string[]} screenshots - The list of screenshots to montage.
 * @param {number} videoWidth - The video width.
 * @param {number} videoHeight - The video height.
 * @param {string} fileName - The video filename.
 * @param {string} duration - The video duration (pre-formatted).
 * @param {string} outputFile - The image output path.
 * @param {CallbackChain} callback - The callback chain that will be called.
 * @returns {void} - Nothing
 */
function createMosaic(screenshots, videoWidth, videoHeight, fileName, duration, outputFile, callback) {
    var imageMagick = [];
    if (mosaicOptions.append_magick.toLowerCase() === "yes") {
        imageMagick.push("magick");
    }
    var imageMagickArgs = [
        "montage",
        "-geometry",
        "".concat(videoWidth, "x").concat(videoHeight, "+").concat(mosaicOptions.padding, "+").concat(mosaicOptions.padding),
    ];
    for (var i = 0; i < screenshots.length; i++) {
        imageMagickArgs.push(screenshots[i]);
    }
    imageMagickArgs.push("".concat(outputFile, ".montage.png"));
    mp.msg.info("Creating image montage: ".concat(outputFile, ".montage.png"));
    dump(imageMagickArgs);
    mp.command_native_async({
        name: "subprocess",
        playback_only: false,
        args: imageMagick.concat(imageMagickArgs),
        capture_stderr: true,
        capture_stdout: true
    }, function (_, result, __) {
        var _a = isMagickSuccess(result), success = _a[0], errorMsg = _a[1];
        mp.msg.info("Montage status: ".concat(success, " || ").concat(errorMsg));
        if (success) {
            runResize(outputFile, videoHeight, function (result2, error2) {
                if (!result2) {
                    callback(false, error2);
                }
                else {
                    runAnnotation(fileName, videoWidth, videoHeight, duration, outputFile, function (result3, error3) {
                        callback(result3, error3);
                    });
                }
            });
        }
        else {
            callback(false, errorMsg);
        }
    });
}
/**
 * Create a collection of screenshots from the video.
 * @param {number} startTime - The start time of the video. (in seconds, relative to video duration)
 * @param {number} timeStep - The time step in-between each screenshot. (in seconds)
 * @param {string} screenshotDir - The temporary folder to be used to save the screenshot.
 * @returns {string[] | undefined} - The list of screenshots created, or undefined if an error occurred.
 */
function screenshotCycles(startTime, timeStep, screenshotDir) {
    var rows = mosaicOptions.rows, columns = mosaicOptions.columns;
    var screenshots = [];
    var totalImages = rows * columns;
    for (var i = 1; i <= totalImages; i++) {
        var tTarget = startTime + (timeStep * (i - 1));
        mp.command_native(["seek", tTarget, "absolute", "exact"]);
        // wait until seeking done
        var imagePath = mp.utils.join_path(screenshotDir, "temp_screenshot-".concat(i, ".png"));
        mp.command_native(["screenshot-to-file", imagePath, mosaicOptions.mode]);
        var errorMsg = mp.last_error();
        if (errorMsg.length > 0) {
            mp.osd_message("创建视频截图失败: " + errorMsg);
            return undefined;
        }
        screenshots.push(imagePath);
    }
    return screenshots;
}
/**
 * Check if the montage command is available. (also check Magick)
 * @returns {boolean} - True if the montage command is available, false otherwise.
 */
function checkMagick() {
    var cmds = [];
    if (mosaicOptions.append_magick.toLowerCase() === "yes") {
        cmds.push("magick");
    }
    cmds.push("montage");
    cmds.push("--version");
    var res = mp.command_native({ name: "subprocess", playback_only: false, args: cmds });
    return res.status === 0;
}
/**
 * Check if the variables of an options are all valid.
 * @returns {boolean} - True if all the options are valid, false otherwise.
 */
function verifyVariables() {
    if (mosaicOptions.rows < 1) {
        mp.osd_message("创建视频摘要的截图行数需要大于0");
        return false;
    }
    if (mosaicOptions.columns < 1) {
        mp.osd_message("创建视频摘要的截图列数需要大于0");
        return false;
    }
    if (mosaicOptions.padding < 0) {
        mp.osd_message("截图或图片之间的间隔大小需要大于0");
        return false;
    }
    var mosaicMode = mosaicOptions.mode.toLowerCase();
    if (mosaicMode !== "video" && mosaicMode !== "subtitles" && mosaicMode !== "window") {
        mp.osd_message("截图模式只能介于(video|subtitles|window)中");
        return false;
    }
    return true;
}
/**
 * Send a formatted OSD message that support ASS tags.
 * @param {string} message - The message to send
 * @param {number} duration - The duration (in seconds, default to `2`)
 */
function sendOSD(message, duration) {
    if (duration === void 0) { duration = 2; }
    var prefix = mp.get_property("osd-ass-cc/0");
    var postfix = mp.get_property("osd-ass-cc/1");
    if (prefix && postfix) {
        mp.osd_message("".concat(prefix).concat(message).concat(postfix), duration);
    }
    else {
        mp.osd_message(message, duration);
    }
}
/**
 * The main execution function, which includes all the check and everything.
 * This should be called immediatly after a macro is executed.
 * @returns {void} - Nothing
 */
function main() {
    // create a mosaic of screenshots
    var paths = new Pathing();
    if (!verifyVariables()) {
        return;
    }
    var magickExist = checkMagick();
    if (!magickExist) {
        var tf = paths.isUnix() ? "false" : "true";
        mp.msg.info("ImageMagick cannot be found, please install it.\nOr you can set append_magick to ".concat(tf, " in the script options."));
        mp.osd_message("无法找到ImageMagick, 请先安装它.".concat("\n或者在脚本的配置文件中设置append_magick为", tf), 5);
        return;
    }
    var imageCount = mosaicOptions.rows * mosaicOptions.columns;
    // get video length and divide by number of screenshots
    var videoLength = mp.get_property_number("duration");
    if (videoLength === undefined) {
        mp.osd_message("获取视频长度失败");
        return;
    }
    // get video width
    var videoWidth = mp.get_property_number("width");
    if (videoWidth === undefined) {
        mp.osd_message("获取视频宽度失败");
        return;
    }
    // get video height
    var videoHeight = mp.get_property_number("height");
    if (videoHeight === undefined) {
        mp.osd_message("获取视频高度失败");
        return;
    }
    // original time position
    var originalTimePos = mp.get_property_number("time-pos");
    if (originalTimePos === undefined) {
        mp.osd_message("获取时间位置失败");
        return;
    }
    mp.msg.info("Running Mosaic Tools with the following options:");
    mp.msg.info("  Rows: " + mosaicOptions.rows);
    mp.msg.info("  Columns: " + mosaicOptions.columns);
    mp.msg.info("  Padding: " + mosaicOptions.padding);
    mp.msg.info("  Format: " + mosaicOptions.format);
    mp.msg.info("  Video Length: " + videoLength);
    mp.msg.info("  Video Width: " + videoWidth);
    mp.msg.info("  Video Height: " + videoHeight);
    var videoDuration = formatDurationToHHMMSS(videoLength);
    // we want to start at 10% of the video length and end at 90%
    var startTime = videoLength * 0.1;
    var endTime = videoLength * 0.9;
    var timeStep = (endTime - startTime) / (imageCount - 1);
    mp.osd_message("正在获取视频截图", 4);
    mp.msg.info("Creating ".concat(mosaicOptions.columns, "x").concat(mosaicOptions.rows, " mosaic of ").concat(imageCount, " screenshots..."));
    // pause video
    var homeDir = mp.command_native(["expand-path", "~~home/"]);
    var screenshotDir = paths.fixPath(mp.utils.join_path(homeDir, "screenshot-mosaic"));
    paths.createDirectory(screenshotDir);
    mp.set_property("pause", "yes");
    var screenshots = screenshotCycles(startTime, timeStep, screenshotDir);
    mp.set_property_number("time-pos", originalTimePos);
    mp.set_property("pause", "no");
    if (screenshots !== undefined) {
        mp.msg.info("Creating mosaic for ".concat(mosaicOptions.columns, "x").concat(mosaicOptions.rows, " images..."));
        mp.osd_message("正在创建视频摘要", 2);
        var fileName = mp.get_property("filename");
        var outputDir = getOutputDir();
        var imgOutput_1 = paths.fixPath(mp.utils.join_path(outputDir, "".concat(createOutputName(fileName), ".").concat(mosaicOptions.format)));
        createMosaic(screenshots, videoWidth, videoHeight, fileName, videoDuration, imgOutput_1, function (success, error) {
            if (success) {
                mp.msg.info("Mosaic created for ".concat(mosaicOptions.columns, "x").concat(mosaicOptions.rows, " images at ").concat(imgOutput_1, "..."));
                sendOSD("视频摘要创建成功", 2);
            }
            else {
                mp.msg.error("Failed to create mosaic for ".concat(mosaicOptions.columns, "x").concat(mosaicOptions.rows, " images..."));
                mp.msg.error(error);
                mp.osd_message("视频摘要创建失败,请检查控制台输出", 2);
            }
            // Cleanup
            mp.msg.info("Cleaning up...");
            screenshots.forEach(function (sspath) {
                paths.deleteFile(paths.fixPath(sspath));
            });
            paths.deleteFile(paths.fixPath("".concat(imgOutput_1, ".montage.png")));
        });
    }
}
mp.add_key_binding("Ctrl+Alt+s", "screenshot-mosaic", main);
