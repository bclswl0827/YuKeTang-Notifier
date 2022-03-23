// ==UserScript==
// @name         雨阔塘课堂限时练习提醒
// @description  雨阔塘课堂限时练习提醒
// @version      v1.0.0
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

// 钉钉机器人 API 地址
var myApi = 'https://d.ibcl.us/robot/send?access_token=' + myToken;

// 封面随机图片 API
var myCover = 'https://api.isoyu.com/bing_images.php';

// 记录是否推送的 Flag，默认 false
var isSent = false;

// 检查是否存在不限时练习
var unlimitQuiz = false;

// 若不存在 id 为 qrcode 的 div，则创建
if (!document.getElementById('qrcode')) {
    // 先在 id 为 app 的 div 后插入 id 为 qrcode 的新 div，设置不可见
    var currentNode = document.getElementById('app');
    var newNode = document.createElement('div');
    newNode.setAttribute('id', 'qrcode');
    newNode.setAttribute('style', 'display: none;');
    currentNode.parentNode.insertBefore(newNode, currentNode.nextSibling);
}
// 初始化二维码对象
var myQrcode = new QRCode(document.getElementById('qrcode'), {
    width: 128,
    height: 128,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
});

// 判断前 30s 是否已经推送过
function checkSent() {
    isSent = false;
    console.log('推送服务已重置');
    return checkSent;
}

// 构造定时器，30s 跑一次
setInterval(checkSent(), 30000);

// 检测是否存在随堂练习的 class
function listenQuiz() {
    // 弹窗提醒 class：pl10 f16 cfff || 倒计时框 class：timing
    var quizNotify = document.getElementsByClassName('pl10 f16 cfff')[0],
        quizTime = document.getElementsByClassName('timing')[0];
    // 排除不限时练习的情况，忽略已结束的练习
    if (quizTime != undefined && quizTime.className == 'timing willEnd') {
        unlimitQuiz = true; // 提示用户存在不限时练习
        quizTime = null;
    } else if (quizTime != undefined) {
        if (quizTime.innerText == '作答已结束' || quizTime.innerText == '倒计时 --:--') {
            quizTime = null;
        }
    }
    // 只要存在一种情况就推送讯息
    if (quizNotify || quizTime) {
        // 弹窗提醒时先切换到弹窗对应的页面
        if (quizNotify) {
            document.getElementsByClassName('box-start')[0].click();
        }
        console.log('检测到新题目');
        createMsg();
    } else {
        console.log('没有检测到新题目');
    }
    return listenQuiz;
}

// 构造定时器，1s 跑一次
setInterval(listenQuiz(), 1000);

// 构造移动端 URL
function convertLink(pcLink) {
    // 寻找数组中最长字符串作为 ID
    longString = function(arr) {
        let longest = arr[0];
        for (let i = 1; i < arr.length; i++) {
            if (arr[i].length > longest.length) {
                longest = arr[i];
            }
        }
        return longest;
    }
    var classId = longString(pcLink.match(/\d{2,}/g));
    var mobiLink = 'https://changjiang.yuketang.cn/lesson/student/v3/' + classId;
    return mobiLink;
}

// 创建用于移动端登入的二维码
function createQr(targetUri) {
    // 获取 Base64 输出
    myQrcode.makeCode(targetUri);
    var base64Output = document.getElementById('qrcode').childNodes[1].getAttribute('src');
    return base64Output;
}

// 创建用于推送的讯息并推送出去
function createMsg() {
    // 检查不限时练习存在情况
    if (unlimitQuiz == true) {
        var freeQuiz = '存在';
        var timeRemain = '未知'
    } else {
        var freeQuiz = '不存在';
        var timeRemain = document.getElementsByClassName('timing')[0].innerText
    }
    // 准备渲染即时讯息模板
    var pcLink = window.location.href;
    var mobiLink = convertLink(pcLink);
    var myMsg = {
        // MarkDown 格式
        msgtype: 'markdown',
        at: {
            // [at] 所有人
            isAtAll: true
        },
        markdown: {
            title: '快！有新题目啦',
            text: '![thumbnail](' + myCover + ')' +
                '\n\n## 来活了，别摸鱼啦！' +
                '\n\n当前时间：' + getTime() +
                '\n\n这是本堂课的第 ' + document.getElementsByClassName('timeline__footer box-between cfff').length + ' 个问题' +
                '\n\n是否存在不限时练习：' + freeQuiz +
                '\n\n距结束还有：' + timeRemain +
                '\n\n当前科目：「' + document.getElementsByTagName('title')[0].innerText + '」' +
                '\n\n当前课程：「' + document.getElementsByClassName('f16')[0].innerText + '」' +
                '\n\n[PC 端课程链接](' + pcLink + ')' +
                '\n\n[移动端课程链接](' + mobiLink + ')' +
                '\n\n移动端亦可在下方扫码进入' +
                '\n\n![QR-Code][' + createQr(mobiLink) + ']' +
                '\n\n在限时练习未结束前，本讯息 30s 后会再次推送' +
                '\n\n以上资讯仅供参考，发送自：' + myKeyword
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
            dataType: 'json',
            type: 'POST',
            async: true,
            url: myApi,
            data: JSON.stringify(sendMsg)
        });
        console.log('已经推送到钉钉群');
        // 最后将 isSent 改为 true
        isSent = true;
    }
}
