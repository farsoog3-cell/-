/* ===================================================
 * client.js - محرك العرض والحسابات (Client Engine)
 * =================================================== */

let playerMoney = 500;

function startGameEngine(gameState) {
    console.log("تم تشغيل محرك المعركة بمال ابتدائي:", gameState.initialMoney);
    
    playerMoney = gameState.initialMoney;
    
    const moneyDisplay = document.getElementById('player-money-display');
    if (moneyDisplay) {
        moneyDisplay.innerText = `${playerMoney} $`;
    }

    // هنا يتم إضافة الأبعاد والـ Three.js Canvas الخاصة بالدبابات
}
