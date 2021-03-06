# WebRTCとは
WebRTCについての少し細かい話と実際の話はいろんな記事でとても分かりやすい記事がたくさんあるので後ほど文献を紹介する<br>
まず初めに概要の概要として理解してもらうために、ざっくりと説明する。

## WebRTC(Web Real-Time Communication)  名前シンプル！
HTMLのAPIの１つで、Webブラウザーなどを介して高速なデータ通信を実現する規格のこと。特に映像や音声などの容量が大きいデータをリアルタイムに送受信できること、**P2P（ピアツーピア）の仕組み**を持っていることから、ビデオチャットやWeb会議などに応用されている。

→少し硬いのでもう少しかみ砕くと、**ビデオとか音声とかメッセージなどのデータをブラウザ間同士で送受信できるプロトコル**<br>
→電話とかアプリなどを必要とせずに**web上ですべて実装ができる**<br>
→skypeとかLINEとかも同じような規格で実装しているらしい<br>

まあチャットアプリとかビデオ通話とかを、ChromeとかFireFoxといったブラウザ上でできるAPIなんだなーくらいでいいと思う

# WebRTCで通信を始めるために

そんな簡単にできるものだったらセキュリティとか速度とか大丈夫なん？というところだがこんなにシンプルなAPIであるのは理由があるわけで<br>
## 実際に自分以外のブラウザと通信をするのに必要な材料

### ・webサーバー  →→→  webページを表示させるためのサーバー<br>　例）apache,nginx,web sever for chrome<br>
### ・シグナリングサーバー  →→→  ブラウザとブラウザをつなげるためのサーバー（JavaScriptで実装）<br>
### ・STUN/TURN サーバー   →→→  後ほど記述<br>




## 何をしたら通信できるのか
### 1. SDP（Session Description Protocol）を交換<br>
### 2. ICE（Interactive Connectivity Establishment）を確保<br>



難しい言葉が出てきたが、<br>
SDPとは通信に必要な各ブラウザの情報を示す文字列。(セッションの属性、メディアの形式、IPアドレス、ポート番号、通信帯域など)<br>
まあ堅苦しいので**自分のSDPといったら私の情報とか住所**とでも考えたらわかりやすいかもしれない<br>

ICEとは相手ブラウザに到達する可能性のある通信経路に関する情報を示したもの<br>
**どの道使ってお互い通信する？といった経路**について書いてあるもの<br>

### これらをシグナリングサーバーを介してお互いに確認しあって初めて、WebRTCでの通信が可能になる<br>

## 1. SDP(私の情報)の交換
最初にSDP（私の情報）をPCから送りあうのだが、流れを書くと<br><br>
 **A1. 私に関する情報を作成**　makeoffer<br>
 **A2. 作ったと同時にA1.で作った自分の情報を暗記する<br>** 
 **A3. あなたの情報ください！！** sendoffer<br>
 **B1. 受け取りまーす、覚えまーす** setoffer <br>
 **B2. 私に関する情報作成** makeanswer<br>
 **B3. 作ったと同時にB1.で作った自分の情報を暗記する<br>** 
 **B4. お待たせでーす！** sendanswer<br>
 **A4. 受け取りまーす、覚えまーす** setanswer<br>


概要図は以下のようになる
![概要図](https://raw.githubusercontent.com/YokoyamaLab/WebRTC-sample/master/webRTC.jpg)


### それぞれで行っていること
**⓪：情報の作成　SDPやICEの作成などはhtml上で行うためwebサーバーにアクセスが必要**   makeoffer<br>
**→⓪´：つながり確認（以後継続）<br>**
**(→暗記なう)<br>**
**→①：offer SDP(SDPを送って、相手の情報が欲しいと伝える)**    sendoffer<br>
**→相手が①を受けとる、暗記**   setoffer<br> 
**→②：情報の作成　⓪と同じ**  makeanswer<br>
**→②´：つながり確認（以後継続）<br>**
**(→暗記なう)<br>**
**→③：answer SDP(相手からの要求に対し答えを送る)**   sendanswer<br>
**→相手からの③を受け取る、暗記**    setanswer<br>
**→④：ICE(通信経路)を交換し合ったら通信可能<br>**




## STUN/TURNサーバー
上記のことを行って、さらに次で説明するブラウザ間でのICE(通信経路)を見つけ通信可能状態になったとしても、wifiを用いてインターネットをつないでいる場合、たいていNAT(Network Address Translation  ネットワークアドレス変換)という障壁がある。<br>
NATについては詳しく書かないが簡単に言うと、**wifiの外から見た自分のPCのIPアドレスとwifi内部でのipアドレス（それぞれグローバルipとプライベートipと呼ぶ）の変換を行う技術**って感じ。<br>
通信するブラウザ同士、**たいていの場合同じネットワーク環境内にいないので、それを可能にするものがSTUN/TURNサーバー**<br>

### ・STUNサーバー
**グローバルipアドレスとか通信可能ポートとかを教えてくれる**
### ・TURNサーバー
俗にいうNAT越えを果たす、もっとも重要なサーバー<br>
STUNがあるといっても、NATやPCによってはポート制限(俗にファイヤーウォール)などの通信制限があり、相手のグローバルipにアクセスできない場合が多々ある。というか**同じネットワーク内にいない場合,ほとんどNATで足止めされる**。その時のためのTURNサーバー。<br>
ブラウザ間での通信がダメな時、仲介サーバーとしてデータを仲介してくれるので通信が可能になるということ。<br>

詳しくは　　　https://qiita.com/okyk/items/a405f827e23cb9ef3bde


## 2. ICE(通信経路)の交換　　Trickle ICE　Vanilla ICE

何度も言っているがICEとは、複数のブラウザ間で通信する場合どのような経路を使って通信するかを書いているもので、これはお互い把握していないと迷子になってしまう。なので先ほど紹介したSTUN/TURNサーバーを使った経路情報を含めた経路情報として送ることになるため、通信ができるようになる。
SDPを交換し終わった後の処理の仕方として、Trickle ICE とVanilla ICEといった二つの方法がある。これについては深くは説明しない。https://qiita.com/massie_g/items/916694413353a3293f73
このサイトに載っている。

ICEの候補(以下ICECanditate)は、SDPの交換が終わったらひたすら総当たりで経路情報を探っている。おそらくこれはブラウザ側が行っている処理。それをSDPの交換が終わってからすぐに送って、送ってもらってを繰り返すうちにつながるやり方が**Trickle ICE**で、すぐには送らずにいろんな候補がたくさん出てきたらまとめて送るというやり方が**Vanilla ICE**。
**今回はTrickle ICEで実装した**。これを送りあっていくうちにpeer-to-peerの通信が可能になるといった流れだ。

![Vanilla_ICE](https://raw.githubusercontent.com/YokoyamaLab/WebRTC-sample/master/Vanilla%20ICE.png)
![Trickle ICE](https://raw.githubusercontent.com/YokoyamaLab/WebRTC-sample/master/Trickle%20ICE.png)

# 以上！！

ここまでがWebRTC通信を行うまでの流れである。私はビデオ通話を実装したのでこの後の処理として、videoの処理がいくつかあるが今回は割愛する。
ここまで読んで、世の中にはびこっているWebRTCやってみた系の記事のコードは読めば理解できると思う。

# オンライン会議のやり方

## 1. ページにアクセス
・URLは別途示しています。

## 2. 接続キーワード、部屋名を入力する

**接続キーワードは教えてもらうこと！**

**部屋名は、通話をする相手と共有すること！**

![参考写真1](https://raw.githubusercontent.com/YokoyamaLab/WebRTC-sample/master/webrtc1_2.jpg)
　
## 3. ビデオ操作の「停止中」をクリック
![参考写真2](https://raw.githubusercontent.com/YokoyamaLab/WebRTC-sample/master/webrtc2_2.jpg)

## 4. ブラウザ側からアクセス許可が来る
![参考写真3](https://raw.githubusercontent.com/YokoyamaLab/WebRTC-sample/master/webrtc3_2.jpg)

## 5. カメラに映っている自分が映る
![参考写真4](https://raw.githubusercontent.com/YokoyamaLab/WebRTC-sample/master/webrtc4.jpg)

## 6. 接続操作の「切断中」をクリック && 同じ部屋名の人とビデオ通話
![参考写真5](https://raw.githubusercontent.com/YokoyamaLab/WebRTC-sample/master/webrtc5.jpg)

