// ==UserScript==
// @name         雨阔塘课堂限时练习提醒
// @description  雨阔塘课堂限时练习提醒
// @version      v1.8.0
// @license      MIT
// @require      https://cdn.staticfile.org/jquery/3.5.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @match        https://*.yuketang.cn/lesson/fullscreen/*
// @run-at       document-end
// ==/UserScript==

// 钉钉机器人 Webhook 参数
var myToken = '';
// 触发机器人用的关键字
var myKeyword = '';
// 发两次提醒的间隔时间（秒）
var myInterval = 60;

// 钉钉机器人 API 地址（需要反向代理解决 CORS 错误）
var myApi = 'https://d.ibcl.us/robot/send?access_token=' + myToken;

// 图床 API（用雨阔塘自家的图床 API）
var imgApi = 'https://changjiang.yuketang.cn/oplat/ueditor/ue?action=uploadimage&encode=utf-8';
//var imgApi = 'https://imgurl.org/upload/aws_s3';

// 记录是否推送的 Flag，默认 false
var isSent = false;

// 先检查老师的雨课堂版本
var softVer;
if (window.location.href.includes('v3')) {
    softVer = 'v3';
} else {
    softVer = 'v2';
}

// 若不存在 id 为 qrcode 的 div，则创建
if (!document.getElementById('qrcode')) {
    // 先在 id 为 app 的 div 后插入 id 为 qrcode 的新 div，设置不可见
    var currentNode = document.getElementById('app');
    var newNode = document.createElement('div');
    newNode.setAttribute('id', 'qrcode');
    newNode.setAttribute('style', 'display: none');
    currentNode.parentNode.insertBefore(newNode, currentNode.nextSibling);
}

// 初始化二维码对象
var myQrcode = new QRCode(document.getElementById('qrcode'), {
    width: 100,
    height: 100,
    // 二维码前景色
    colorDark: '#6A1A4C',
    // 二维码背景色
    colorLight: '#fff',
    // 容错级别，可设置为：
    correctLevel: QRCode.CorrectLevel.H
});

// 判断前 30s 是否已经推送过
function checkSent() {
    isSent = false;
    return checkSent;
}

// 构造定时器，重置 Flag
setInterval(checkSent(), myInterval * 1000);

// 构造移动端 URL
function convertLink(pcLink) {
    // 寻找数组中最长字符串作为 ID
    longString = function (arr) {
        let longest = arr[0];
        for (let i = 1; i < arr.length; i++) {
            if (arr[i].length > longest.length) {
                longest = arr[i];
            }
        }
        return longest;
    }
    // 正则匹配课程 ID，ID 一般蛮长的，所以提取出来取最长的字符串即为 ID
    var classId = longString(pcLink.match(/\d{2,}/g));
    // 正则匹配
    var exerciseId = pcLink.match(/\/(exercise|blank)\/\d*/g);
    var mobiLink;
    // 检查 ID 长度，v3 版本 ID 比 v2 长，不同版本移动端 URL 亦不同
    if (classId.length < 15) {
        mobiLink = 'https://changjiang.yuketang.cn/lesson/student/' + classId;
    } else {
        mobiLink = 'https://changjiang.yuketang.cn/lesson/student/v3/' + classId;
    }
    if (exerciseId) mobiLink += exerciseId[0];
    return mobiLink;
}

// 获取题目类型（v3 版本）
function quizCheck(softVer) {
    // V3 版本格式
    var quizClass = document.getElementsByClassName('timing')[0].className, quizType, timeRemain;
    if (softVer == 'v3') {
        // 限时选择题（没有名为 timing willEnd 的 class && 有倒计时 class && 倒计时内容有关键字「倒计时」 && slide__shape submit-btn 内文含有关键字「提交」）
        if (quizClass != 'timing willEnd' && document.getElementsByClassName('timing timing--number')[0]) {
            var timeCount = document.getElementsByClassName('timing timing--number')[0],
                submitBotton = document.getElementsByClassName('slide__shape submit-btn')[0];
            if (timeCount.innerText.includes('倒计时') && submitBotton.innerText.includes('提交')) {
                // 若倒计时未显示则提供一个大致时间范围
                if (document.getElementsByClassName('timing timing--number')[0].innerText.includes('--:--')) {
                    timeRemain = '约 1-5 分钟';
                } else {
                    timeRemain = document.getElementsByClassName('timing timing--number')[0].innerText;
                }
                // 返回题目类型及剩余时间
                quizType = {
                    type: '限时选择题',
                    remain: timeRemain
                }
            } else if (timeCount.innerText.includes('倒计时') && timeCount.innerText.includes('结束') != true && submitBotton.innerText.includes('作答')) { // 限时填空题（没有名为 timing willEnd 的 class && 有倒计时 class && 倒计时内容有关键字「倒计时」 && slide__shape submit-btn 内文含有关键字「作答」）
                // 若倒计时未显示则提供一个大致时间范围
                if (document.getElementsByClassName('timing timing--number')[0].innerText.includes('--:--')) {
                    timeRemain = '约 1-5 分钟';
                } else {
                    timeRemain = document.getElementsByClassName('timing timing--number')[0].innerText;
                }
                // 返回题目类型及剩余时间
                quizType = {
                    type: '限时填空题',
                    remain: timeRemain
                }
            }
        } else if (quizClass == 'timing willEnd') { // 不限时选择题（有名为 timing willEnd 的 class && slide__shape submit-btn 内文含有关键字「提交」）
            submitBotton = document.getElementsByClassName('slide__shape submit-btn')[0];
            if (submitBotton.innerText.includes('提交') && !document.getElementsByClassName('timing timing--number')[0]) {
                quizType = {
                    type: '不限时选择题',
                    remain: '不限时'
                }
            } else { // 不限时填空题（有名为 timing willEnd 的 class && slide__shape submit-btn 内文含有关键字「作答」）
                quizType = {
                    type: '不限时填空题',
                    remain: '不限时'
                }
            }
        }
    } else { // 否则为 V2 版本格式
        // 限时选择题（有 timing--number f32 这个 class && 有个 exercise-options 的 class）
        if (document.getElementsByClassName('timing--number f32')[0] && document.getElementsByClassName('exercise-options')[0]) {
            if (document.getElementsByClassName('timing--number f32')[0].innerText.includes('00:00')) {
                timeRemain = '约 1-5 分钟';
                quizType = {
                    type: '限时选择题',
                    remain: timeRemain
                }
            } else {
                timeRemain = document.getElementsByClassName('timing--number f32')[0].innerText;
                quizType = {
                    type: '限时选择题',
                    remain: timeRemain
                }
            }
        } else if (document.getElementsByClassName('timing--number f32')[0] && document.getElementsByClassName('blanks__header f20')[0]) { // 限时填空题（有 timing--number f32 这个 class && 有个 blanks__header f20 的 class）
            if (document.getElementsByClassName('timing--number f32')[0].innerText.includes('00:00')) {
                timeRemain = '约 1-5 分钟';
                quizType = {
                    type: '限时填空题',
                    remain: timeRemain
                }
            } else {
                timeRemain = document.getElementsByClassName('timing--number f32')[0].innerText;
                quizType = {
                    type: '限时填空题',
                    remain: timeRemain
                }
            }
        } else if (document.getElementsByClassName('timing')[0].className == 'timing f24' && document.getElementsByClassName('exercise-options')) { // 不限时选择题（有名为 timing f24 的 class && 有个 exercise-options 的 class）
            quizType = {
                type: '不限时选择题',
                remain: '不限时'
            }
        } else if (document.getElementsByClassName('timing')[0].className == 'timing f24' && document.getElementsByClassName('blanks__header f20')) { // 不限时选择题（有名为 timing f24 的 class && 有名为 blanks__header f20 的 class）
            quizType = {
                type: '不限时填空题',
                remain: '不限时'
            }
        }
    }
    return quizType;
}


// 检测是否存在随堂练习的 class
function listenQuiz() {
    // 先为当前页面创建二维码
    myQrcode.makeCode(convertLink(window.location.href));
    // 先判断目前是否普通课件页面（无 slide__shape submit-btn || 无 submit-btn f18）（ && 有名为 timing willEnd 的 class）
    if (softVer == 'v3') {
        if (!document.getElementsByClassName('slide__shape submit-btn')[0]) { //&& document.getElementsByClassName('timing')[0].className == 'timing willEnd') {
            console.log('当前为普通课件');
            return listenQuiz;
        } else {
            // 检查当前是否有弹窗提醒，有则先前往弹窗
            var quizNotifier = document.getElementsByClassName('pl10 f16 cfff')[0];
            if (quizNotifier && quizNotifier.innerText == 'Hi, 你有新的课堂习题') {
                document.getElementsByClassName('box-start')[0].click();
            }
            // 做一次校验，提高准确率
            var quizInfo = quizCheck(softVer);
            if (quizInfo && quizInfo.remain == quizCheck(softVer).remain) {
                console.log('检测到有题目');
            } else {
                console.log('本题已经过期，忽略');
                return listenQuiz;
            }
            console.log(quizInfo);
            createMsg(quizInfo);
        }
    } else {
        if (!document.getElementsByClassName('submit-btn f18')[0]) { //&& document.getElementsByClassName('timing')[0].className == 'timing willEnd') {
            console.log('当前为普通课件');
            return listenQuiz;
        } else {
            // 检查当前是否有弹窗提醒，有则先前往弹窗
            var quizNotifier = document.getElementsByClassName('pl10 f16 cfff')[0];
            if (quizNotifier && quizNotifier.innerText == 'Hi, 你有新的课堂习题') {
                document.getElementsByClassName('box-start')[0].click();
            }
            // 做一次校验，提高准确率
            var quizInfo = quizCheck(softVer);
            if (quizInfo && quizInfo.remain == quizCheck(softVer).remain) {
                console.log('检测到有题目');
            } else {
                console.log('本题已经过期，忽略');
                return listenQuiz;
            }
            console.log(quizInfo);
            createMsg(quizInfo);
        }
    }
    return listenQuiz;
}

// 构造定时器，2s 跑一次
setInterval(listenQuiz(), 2000);

// 上传二维码到图床
function uploadCode(data) {
    // 将 Base64 转为 Blob
    function convertBase64(base64Data) {
        // 去掉 Base64 的头部信息，并转换为 Byte
        var split = base64Data.split(',');
        var bytes = window.atob(split[1]);
        // 处理异常，将 ASCii 码小于 0 的转换为大于 0
        var ab = new ArrayBuffer(bytes.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < bytes.length; i++) {
            ia[i] = bytes.charCodeAt(i);
        }
        // 获取文件类型，从 Base64 前缀中提取
        return new Blob([ab], {
            type: split[0].match(/:(.*?);/)[1]
        });
    }
    // 避免大量请求导致滥用 API，限制请求在变量 isSent 为 false 时才执行
    if (!isSent) {
        var myCode = convertBase64(data);
        var formData = new FormData();
        var fileBlob = new File([myCode], (new Date()).valueOf() + '.png');
        var codeUrl = '';
        formData.append("file", fileBlob);
        formData.append("bizType", "9");
        $.ajax({
            type: 'POST',
            data: formData,
            url: imgApi,
            processData: false,
            contentType: false,
            async: false,
            success: function (data) {
                codeUrl = data.url;
            }
        });
    }
    return codeUrl;
}

// 若是选择题，则随机给一个选项
function myOption() {
    var e = 1,
        t = "ABCD",
        a = t.length,
        n = "";
    for (var i = 0; i < e; i++) n += t.charAt(Math.floor(Math.random() * a));
    return n;
}

// 创建用于推送的讯息并推送出去
function createMsg(quizInfo) {
    // 准备渲染即时讯息模板
    var pcLink = window.location.href;
    var mobiLink = convertLink(pcLink);
    var codeUrl = uploadCode(document.getElementById('qrcode').childNodes[1].getAttribute('src'));
    var myMsg = {
        // MarkDown 格式
        msgtype: 'markdown',
        at: {
            // [at] 所有人
            isAtAll: true
        },
        markdown: {
            title: '快！有新题目啦',
            // 配图为二维码
            text: '![QR Code](' + codeUrl + ')' +
                '\n\n## 来活了，别摸鱼啦！' +
                '\n\n当前时间：' + getTime() +
                '\n\n[PC 端课程链接](' + pcLink + ')' +
                '\n\n[移动端课程链接](' + mobiLink + ')' +
                '\n\n移动端亦可在上方扫码进入' +
                '\n\n当前科目：「' + document.getElementsByTagName('title')[0].innerText + '」' +
                '\n\n当前课程：「' + document.getElementsByClassName('f16')[0].innerText + '」' +
                '\n\n问题类型：' + quizInfo.type +
                '\n\n这是本堂课的第 ' + document.getElementsByClassName('timeline__footer box-between cfff').length + ' 个问题' +
                '\n\n距结束还剩下：' + quizInfo.remain +
                '\n\n针对选择题给出的随机值：' + myOption() +
                '\n\n监控者未完成该练习前，本讯息 ' + myInterval + ' 秒后将再次推送' +
                '\n\n以上资讯仅供参考可能存在不准确的情况' +
                '\n\n老师所用雨课堂版本：' + softVer +
                '\n\n发送自：' + myKeyword
        }
    };
    // 若监控者已完成则不调用推送函数
    if (quizInfo.remain != '已完成')
        pushMsg(myApi, myMsg);
}

// 获取题目发布的时间
function getTime() {
    var timeNow = new Date();
    var getMonth = (timeNow.getMonth() + 1).toString();
    var getDate = timeNow.getDate().toString();
    var getHour = timeNow.getHours().toString().padStart(2, '0');
    var getMinute = timeNow.getMinutes().toString().padStart(2, '0');
    var currentTime = getMonth + ' 月 ' + getDate + ' 日 ' + getHour + ':' + getMinute;
    return currentTime;
}

// 推送讯息到钉钉
function pushMsg(myApi, sendMsg) {
    // 先判断之前是否已经推送
    if (isSent == false) {
        $.ajax({
            contentType: "application/json; charset=utf-8",
            dataType: 'json',
            type: 'POST',
            async: true,
            url: myApi,
            data: JSON.stringify(sendMsg)
        });
        console.log(sendMsg);
        console.log('已经推送到钉钉群');
        // 最后将 isSent 改为 true
        isSent = true;
    }
}

// 答题完成后，移除按钮，避免继续发送
function removeButton() {
    var submitBotton = document.querySelector('p[class="submit-btn f18"]')
    if (submitBotton) {
        if (submitBotton.innerText.includes('成功'))
            submitBotton.parentNode.removeChild(submitBotton);
    }
    return removeButton;
}

// 1s 跑一次
setInterval(removeButton(), 1000);
