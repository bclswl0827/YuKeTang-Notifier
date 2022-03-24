// ==UserScript==
// @name         雨阔塘课堂限时练习提醒
// @description  雨阔塘课堂限时练习提醒
// @version      v1.1.0
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
var myInterval = 60

// 钉钉机器人 API 地址
var myApi = 'https://d.ibcl.us/robot/send?access_token=' + myToken;

// 图床 API
var imgApi = 'https://imgurl.org/upload/aws_s3';

// 记录是否推送的 Flag，默认 false
var isSent = false;

// 若不存在 id 为 qrcode 的 div，则创建
if (!document.getElementById('qrcode')) {
    // 先在 id 为 app 的 div 后插入 id 为 qrcode 的新 div，设置不可见
    var currentNode = document.getElementById('app');
    var newNode = document.createElement('div');
    newNode.setAttribute('id', 'qrcode');
    currentNode.parentNode.insertBefore(newNode, currentNode.nextSibling);
}

// 初始化二维码对象
var myQrcode = new QRCode(document.getElementById('qrcode'), {
    width: 128,
    height: 128,
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

// 模拟 sleep
function fakeSleep(time) {
    const start = new Date().getTime();
    while (new Date().getTime() - start < time) { }
    return;
}

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
    var classId = longString(pcLink.match(/\d{2,}/g));
    var exerciseId = pcLink.match(/\/(exercise|blank)\/\d*/g);
    var mobiLink = 'https://changjiang.yuketang.cn/lesson/student/v3/' + classId
    if (exerciseId) mobiLink += exerciseId[0];
    return mobiLink;
}

// 检测是否存在随堂练习的 class
function listenQuiz() {
    // 先为当前页面创建二维码
    myQrcode.makeCode(convertLink(window.location.href));
    // 获取题目类型
    // 限时选择题（没有名为 timing willEnd 的 class && 有倒计时 class && 倒计时内容有关键字「倒计时」 && slide__shape submit-btn 内文含有关键字「提交」）
    // 限时填空题（没有名为 timing willEnd 的 class && 有倒计时 class && 倒计时内容有关键字「倒计时」 && slide__shape submit-btn 内文含有关键字「作答」）
    // 不限时选择题（有名为 timing willEnd 的 class && slide__shape submit-btn 内文含有关键字「提交」）
    // 不限时填空题（有名为 timing willEnd 的 class && slide__shape submit-btn 内文含有关键字「作答」）
    function quizCheck() {
        var quizClass = document.getElementsByClassName('timing')[0].className, quizType, timeRemain;
        if (quizClass != 'timing willEnd' && document.getElementsByClassName('timing timing--number')[0]) {
            var timeCount = document.getElementsByClassName('timing timing--number')[0],
                submitBotton = document.getElementsByClassName('slide__shape submit-btn')[0];
            if (timeCount.innerText.includes('倒计时') && submitBotton.innerText.includes('提交')) {
                // 直到倒计时不为「倒计时 --:--」跳出循环
                for (var i = 0; i < 5; i++) {
                    timeRemain = document.getElementsByClassName('timing timing--number')[0].innerText;
                    if (document.getElementsByClassName('timing timing--number')[0].innerText != '倒计时 --:--') {
                        timeRemain = document.getElementsByClassName('timing timing--number')[0].innerText;
                        break;
                    } else {
                        fakeSleep(200);
                    }
                }
                // 返回题目类型及剩余时间
                quizType = {
                    type: '限时选择题',
                    remain: document.getElementsByClassName('timing timing--number')[0].innerText
                }
            } else if (timeCount.innerText.includes('倒计时') && timeCount.innerText.includes('结束') != true && submitBotton.innerText.includes('作答')) {
                // 直到倒计时不为「倒计时 --:--」跳出循环
                for (var i = 0; i < 5; i++) {
                    if (document.getElementsByClassName('timing timing--number')[0].innerText != '倒计时 --:--') {
                        timeRemain = document.getElementsByClassName('timing timing--number')[0].innerText;
                        break;
                    } else {
                        fakeSleep(200);
                    }
                }
                // 返回题目类型及剩余时间
                quizType = {
                    type: '限时填空题',
                    remain: document.getElementsByClassName('timing timing--number')[0].innerText
                }
            }
        } else if (quizClass == 'timing willEnd') {
            submitBotton = document.getElementsByClassName('slide__shape submit-btn')[0];
            if (submitBotton.innerText.includes('提交') && !document.getElementsByClassName('timing timing--number')[0]) {
                quizType = {
                    type: '不限时选择题',
                    remain: '不限时'
                }
            } else {
                quizType = {
                    type: '不限时填空题',
                    remain: '不限时'
                }
            }
        }
        return quizType;
    }
    // 先判断目前是否普通课件页面（无 slide__shape submit-btn）（ && 有名为 timing willEnd 的 class）
    if (!document.getElementsByClassName('slide__shape submit-btn')[0]) {//&& document.getElementsByClassName('timing')[0].className == 'timing willEnd') {
        console.log('当前为普通课件');
        return listenQuiz;
    } else {
        // 做一次校验
        var quizInfo = quizCheck();
        if (quizInfo && quizInfo.remain == quizCheck().remain) {
            console.log('检测到有题目');
            // 检查当前是否有弹窗提醒，有则先前往弹窗
            var quizNotifier = document.getElementsByClassName('pl10 f16 cfff')[0];
            if (quizNotifier && quizNotifier.innerText == 'Hi, 你有新的课堂习题') {
                document.getElementsByClassName('box-start')[0].click();
            }
        } else {
            console.log('本题已经过期，忽略');
            return listenQuiz;
        }
        createMsg(quizInfo);
    }
    return listenQuiz;
}

// 构造定时器，1s 跑一次
setInterval(listenQuiz(), 1000);

// 上传二维码到图床
function uploadCode(data) {
    // 将 Base64 转为 Blob
    function convertBase64(base64Data) {
        // 去掉 Base64 的头部信息，并转换为 Byte
        var split = base64Data.split(',');
        var bytes = window.atob(split[1]);
        // 处理异常,将 ASCii 码小于 0 的转换为大于 0
        var ab = new ArrayBuffer(bytes.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < bytes.length; i++) {
            ia[i] = bytes.charCodeAt(i);
        }
        // 获取文件类型
        return new Blob([ab], {
            type: split[0].match(/:(.*?);/)[1]
        });
    }
    // 避免大量请求，限制请求在 isSent 为 false 时才执行
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
                '\n\n距结束还剩下：' + document.getElementsByClassName('timing timing--number')[0].innerText +
                '\n\n在限时练习未结束前，本讯息 60s 后会再次推送' +
                '\n\n以上资讯仅供参考可能存在不准确的情况' +
                '\n\n发送自：' + myKeyword
        }
    };
    // 调用发送函数
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
