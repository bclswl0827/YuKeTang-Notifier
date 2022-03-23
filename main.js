// ==UserScript==
// @name         雨阔塘课堂限时练习提醒
// @description  雨阔塘课堂限时练习提醒
// @version      v1.0.0
// @license      MIT
// @require      https://cdn.staticfile.org/jquery/3.5.1/jquery.min.js
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @match        https://*.yuketang.cn/lesson/fullscreen/*
// @run-at       document-end
// ==/UserScript==

// 钉钉机器人 WebHook 参数和关键字
var myToken = '';
var myKeyword = '';

// 钉钉机器人 API 地址（需反代才能允许 CORS）
var myApi = 'https://d.ibcl.us/robot/send?access_token=' + myToken;

// 封面随机图片 API
var myCover = 'https://api.isoyu.com/bing_images.php';

// 记录是否推送的 Flag，默认 false
var isSent = false;

// 判断前 30s 是否已经推送过
function checkSent() {
    isSent = false;
    console.log(' 推送服务已重置');
    return checkSent;
}

// 构造定时器，30s 跑一次
setInterval(checkSent(), 30000);

// 构造一个定时器，1s 执行一次，监听随堂练习的 Class
function listenQuiz() {
    // 1. 弹窗提醒 class：pl10 f16 cfff
    // 2. 倒计时框 class：timing f24
    // 任有其一即可
    setInterval(function() {
        var quizNotify = document.getElementsByClassName('pl10 f16 cfff')[0],
            quizTime = document.getElementsByClassName('timing f24')[0];
        if (quizNotify || quizTime) {
            console.log(' 检测到新题目');
            createMsg();
        } else {
            console.log(' 没有检测到新题目');
        }
    }, 1000);
}
listenQuiz();

// 创建用于推送的讯息并推送出去
function createMsg() {
    var myMsg = {
        // MarkDown 格式
        msgtype: 'markdown',
        at: {
            // [at] 所有人
            isAtAll: true
        },
        markdown: {
            title: ' 快！有新题目啦',
            text: '![thumbnail](' + myCover + ')' +
                '\n\n### 别摸鱼了！\n\n' + getTime() +
                '\n\n 当前科目：' + document.getElementsByTagName('title')[0].innerText +
                '\n\n 当前课程：「' + document.getElementsByClassName('f16')[0].innerText + '」\n\n' +
                '[点击链接前往课程答题](' + window.location.href + ')（仅 Web 端）\n\n' +
                ' 本讯息发送自：' + myKeyword
        }
    };
    // 调用发送函数
    pushMsg(myApi, myMsg);
}

// 获取题目发布的时间
function getTime() {
    var timeNow = new Date();
    var getMonth = (timeNow.getMonth() + 1).toString().padStart(2, '0');
    var getDate = timeNow.getDate().toString().padStart(2, '0');
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
            dataType: 'application/json',
            type: 'POST',
            async: true,
            url: myApi,
            data: JSON.stringify(sendMsg)
        });
        console.log(' 已经推送到钉钉群');
        // 最后将 isSent 改为 true
        isSent = true;
    }
}
