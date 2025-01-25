// TimberMan - Clone of http://www.digitalmelody.eu/games/Timberman

// Load Progress 
var loadProgress = 0, countSprites = 25;

// Level
var levelLoad = 0;
var levelMenu = 1;
var levelPlay = 2;
var levelGameOver = 3;
var level = levelLoad;

// Score
var levelscore = 1;
var score = 0, number = [];
var bestscore = 0;

// Trunk
var trunk = [], TrunkHeight = 243;

// Screen
openScreen("game", 0, 0, 1080, 1775);
initMouse();
initKeyboard();
resizeScreen(true);

// Load sprites
var background = loadSprite("/assets/background.png", onReady);

// Intro
var clic = loadSprite("/assets/clic.png", onReady);
var or = loadSprite("/assets/or.png", onReady);
var left = loadSprite("/assets/left.png", onReady);
var right = loadSprite("/assets/right.png", onReady);

// Trunk
var stump = loadSprite("/assets/stump.png", onReady);
var trunk1 = loadSprite("/assets/trunk1.png", onReady);
var branchleft = loadSprite("/assets/branch1.png", onReady);
var branchright = loadSprite("/assets/branch2.png", onReady);

// Game Over
var rip = loadSprite("/assets/rip.png", onReady);
var gameover = loadSprite("/assets/gameover.png", onReady);
var play = loadSprite("/assets/play.png", onReady, restartGame);

// Timberman
var man = loadSprite("/assets/man.png", onReady);

// Score
for(var n=0; n<10; n++) {
    number[n] = loadSprite("/assets/numbers.png", onReady);
}

// Progress bar
var timecontainer = loadSprite("/assets/time-container.png", onReady);
var timebar = loadSprite("/assets/time-bar.png", onReady);	

// В начале файла добавим переменную для хранения последнего счета
var lastScore = 0;

// Sound effects initialization
if (!window.gameAudio) {
    // Получаем состояние звука из localStorage (по умолчанию включен)
    const isSoundEnabled = localStorage.getItem('gameSound') !== 'false';
    
    window.gameAudio = {
        deathSound: new Audio('/assets/sounds/death.mp3'),
        cutSound: new Audio('/assets/sounds/cut.mp3'),
        isSoundEnabled: isSoundEnabled,
        
        toggleSound: function() {
            this.isSoundEnabled = !this.isSoundEnabled;
            localStorage.setItem('gameSound', this.isSoundEnabled);
            
            // Обновляем иконку
            const soundIcon = document.getElementById('soundIcon');
            if (soundIcon) {
                soundIcon.textContent = this.isSoundEnabled ? '🔊' : '🔇';
            }
        },
        
        // Функция создания кнопки звука
        createSoundButton: function() {
            const existingBtn = document.getElementById('soundButton');
            if (existingBtn) {
                existingBtn.remove();
            }

            const gameContainer = document.getElementById('game-container');
            if (!gameContainer) return;

            const soundBtn = document.createElement('button');
            soundBtn.id = 'soundButton';
            
            // Используем SVG иконки для лучшего качества
            const soundOnIcon = `
                <svg class="sound-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4L7 8H4V16H7L12 20V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path class="wave wave1" d="M16 8.5C17.3333 10 17.3333 14 16 15.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path class="wave wave2" d="M19 6C21.3333 8.5 21.3333 15.5 19 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `;

            const soundOffIcon = `
                <svg class="sound-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4L7 8H4V16H7L12 20V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path class="mute-line" d="M20 4L4 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `;

            soundBtn.innerHTML = `
                <div class="icon-container">
                    ${this.isSoundEnabled ? soundOnIcon : soundOffIcon}
                </div>
            `;

            soundBtn.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                width: 48px;
                height: 48px;
                background: rgba(0, 0, 0, 0.6);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                z-index: 9999;
                backdrop-filter: blur(8px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                color: #ffffff;
            `;

            // Обновляем стили
            const style = document.createElement('style');
            style.id = 'soundButtonStyles';
            style.textContent = `
                #soundButton {
                    overflow: hidden;
                }
                
                #soundButton:hover {
                    transform: translateY(-2px);
                    background: rgba(0, 0, 0, 0.8);
                    border-color: rgba(255, 255, 255, 0.2);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                }
                
                #soundButton:active {
                    transform: translateY(1px);
                }
                
                #soundButton .icon-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                }
                
                #soundButton .sound-icon {
                    transition: transform 0.3s ease;
                }
                
                #soundButton:hover .sound-icon {
                    transform: scale(1.1);
                }
                
                @keyframes wave {
                    0% { opacity: 0; }
                    50% { opacity: 1; }
                    100% { opacity: 0; }
                }
                
                .wave {
                    animation: wave 2s infinite;
                }
                
                .wave1 {
                    animation-delay: 0.2s;
                }
                
                .wave2 {
                    animation-delay: 0.4s;
                }
                
                .mute-line {
                    stroke-dasharray: 24;
                    stroke-dashoffset: ${this.isSoundEnabled ? '24' : '0'};
                    transition: stroke-dashoffset 0.3s ease;
                }
            `;

            soundBtn.addEventListener('click', () => {
                this.toggleSound();
                soundBtn.innerHTML = `
                    <div class="icon-container">
                        ${this.isSoundEnabled ? soundOnIcon : soundOffIcon}
                    </div>
                `;
            });

            // Удаляем старые стили, если есть
            const oldStyle = document.getElementById('soundButtonStyles');
            if (oldStyle) oldStyle.remove();
            
            document.head.appendChild(style);
            gameContainer.appendChild(soundBtn);
        },
        
        loadSound: async function() {
            try {
                await Promise.all([
                    this.deathSound.load(),
                    this.cutSound.load()
                ]);
                console.log('All sounds loaded successfully');
            } catch (error) {
                console.error('Failed to load sounds:', error);
            }
        }
    };

    // Добавляем стили для hover эффекта один раз
    if (!document.getElementById('soundButtonStyles')) {
        const style = document.createElement('style');
        style.id = 'soundButtonStyles';
        style.textContent = `
            #soundButton:hover {
                transform: scale(1.1);
                background: rgba(0, 0, 0, 0.7);
            }
            #soundButton:active {
                transform: scale(0.95);
            }
        `;
        document.head.appendChild(style);
    }

    // Предзагрузка всех звуков
    window.gameAudio.deathSound.preload = 'auto';
    window.gameAudio.cutSound.preload = 'auto';
    
    window.gameAudio.loadSound();

    document.addEventListener('touchstart', function() {
        window.gameAudio.loadSound();
    }, { once: true });
}

// Модифицируем функции воспроизведения звука
function playCutSound() {
    if (!window.gameAudio.isSoundEnabled) return;
    
    try {
        if (window.gameAudio.cutSound.readyState >= 2) {
            window.gameAudio.cutSound.currentTime = 0;
            const playPromise = window.gameAudio.cutSound.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn("Cut sound playback failed:", error);
                });
            }
        }
    } catch (error) {
        console.warn("Error playing cut sound:", error);
    }
}

function onReady() {
	loadProgress++
	
	if (loadProgress == countSprites) {
		
		// Changement du point d'ancrage du bucheron et ajout des animations
		anchorSprite(man, 0.5, 0.5);
		man.x = 263;
		
		addAnimation(man, "breath", [2,3], 527, 413, 350);
		addAnimation(man, "cut", [0,1,0], 527, 413, 15);
		
		// Creation de l'arbre
		trunk1.data = "trunk1";
		branchleft.data = "branchleft";
		branchright.data = "branchright";
		
		initTrunk();
		
		// Creation des image représentant chaque chiffre 
		clipSprite(number[0], 5, 5, 66, 91); 		
		clipSprite(number[1], 81, 5, 50, 91); 		
		clipSprite(number[2], 141, 5, 66, 91); 		
		clipSprite(number[3], 217, 5, 66, 91); 		
		clipSprite(number[4], 293, 5, 66, 91); 		
		clipSprite(number[5], 369, 5, 66, 91); 		
		clipSprite(number[6], 445, 5, 66, 91); 		
		clipSprite(number[7], 521, 5, 66, 91); 		
		clipSprite(number[8], 597, 5, 66, 91); 		
		clipSprite(number[9], 673, 5, 66, 91); 		
		
		// Position niveau load
		level = levelLoad;
		
		// Mémorisation du meilleurs scrore
		if (localStorage.bestscore) {
			bestscore = Number(localStorage.bestscore);
		}
		
		// Visualisation du jeu
		renderGame();
	}
}

function initTrunk() {
	trunk = [0, 0, 0, 0, 0, 0, 0]
	// Construction des branches
	// Il ne faut pas quune branche apparaisse sur le personnage directement après avoir lancé le jeu.
	// ==> il faut placer 2 troncs sans branches ds le début
	trunk[0] = copySprite(trunk1);
	trunk[1] = copySprite(trunk1);
	addTrunk();
	
	score = 0;
	timescore = 254;
	levelscore = 1;
}

function addTrunk() {	
	for(var i = 1; i < 7; i++) {
		// Si pas de tronon
		if (trunk[i] === 0) {
			// Il ne peut pas y avoir 2 branches à la suite.
			// => le troncon précédent doit etre un tronc
			if (trunk[i-1].data == "trunk1") {
				// 1 chance sur 4 de placer un tronc sans branche
				if(Math.random() * 4 <= 1) {			
					trunk[i] = copySprite(trunk1);
	
					// 3 chances sur 4 de placer une branche	
				} else {
					if (Math.random() * 2 < 1) {
						trunk[i] = copySprite(branchleft);
					} else {
						trunk[i] = copySprite(branchright);
					}
				}
			// Le troncon précédent n'est pas un tronc 
			// ==> On place un tronc
			} else {
				trunk[i] = copySprite(trunk1);	
			}
		}
	}
}

function restartGame() {
	// Скрываем кнопку шаринга при рестарте
	const shareBtn = document.getElementById('shareButton');
	if (shareBtn) {
		shareBtn.style.display = 'none';
	}
	
	score = 0;
	initTrunk();
	level = levelMenu;
}

function gameOver() {
	// Проверяем состояние звука перед воспроизведением
	if (window.gameAudio.isSoundEnabled) {
		try {
			if (window.gameAudio.deathSound.readyState >= 2) {
				window.gameAudio.deathSound.currentTime = 0;
				const playPromise = window.gameAudio.deathSound.play();
				if (playPromise !== undefined) {
					playPromise.catch(error => {
						console.warn("Death sound playback failed:", error);
					});
				}
			}
		} catch (error) {
			console.warn("Error playing death sound:", error);
		}
	}

	level = levelGameOver;
	
	// Сохраняем текущий счет перед сбросом
	lastScore = score;
	
	// Сохраняем рекорд в localStorage для проверки задач
	const currentHighScore = localStorage.getItem('timbermanHighScore') || 0;
	if (score > currentHighScore) {
		localStorage.setItem('timbermanHighScore', score);
	}

	// Сохраняем рекорд в bestscore
	if (score > bestscore) {
		bestscore = score;
		localStorage.setItem('bestscore', bestscore);

		// Отправляем новый рекорд на сервер
		fetch('/update-high-score', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-telegram-init-data': window.Telegram.WebApp.initData
			},
			body: JSON.stringify({
				telegramId: window.Telegram.WebApp.initDataUnsafe.user.id,
				highScore: score
			})
		})
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				console.log('High score updated successfully');
			}
		})
		.catch(error => {
			console.error('Error updating high score:', error);
		});
	}

	// Добавляем текущий счет к общему DPS и обновляем баланс
	fetch('/update-balances', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-telegram-init-data': window.Telegram.WebApp.initData
		},
		body: JSON.stringify({
			telegramId: window.Telegram.WebApp.initDataUnsafe.user.id,
			amount: parseInt(score),
			type: 'game'
		})
	})
	.then(response => response.json())
	.then(data => {
		if (data.success) {
			console.log('Balance updated successfully:', data.balances);
			
			// Обновляем локальные счетчики
			let totalDPS = parseInt(localStorage.getItem('totalDPS')) || 0;
			let totalGameEarnings = parseInt(localStorage.getItem('totalGameEarnings')) || 0;
			
			totalDPS += parseInt(score);
			totalGameEarnings += parseInt(score);
			
			localStorage.setItem('totalDPS', totalDPS.toString());
			localStorage.setItem('totalGameEarnings', totalGameEarnings.toString());
		} else {
			console.error('Failed to update balance:', data.error);
		}
	})
	.catch(error => {
		console.error('Error updating balance:', error);
	});


	const totalGameDPS = parseInt(localStorage.getItem('totalGameDPS')) || 0; 
 localStorage.setItem('totalGameDPS', (totalGameDPS + score).toString());
	// Отправляем событие с результатом игры
	
	const gameOverEvent = new CustomEvent('gameOver', { 
		detail: { 
			score: lastScore
		}
	});
	window.dispatchEvent(gameOverEvent);

	// Сброс параметров игры
	levelscore = 1;
	timescore = 508;
	
	// Очистка и пересоздание дерева
	trunk = [];
	initTrunk();

	// Увеличиваем счетчик сыгранных игр
	const totalGamesPlayed = parseInt(localStorage.getItem('totalGamesPlayed')) || 0;
	localStorage.setItem('totalGamesPlayed', (totalGamesPlayed + 1).toString());

	// Обновляем баланс
	window.dispatchEvent(new CustomEvent('balanceUpdated'));

	// Создаем HTML кнопку для шаринга
	let shareBtn = document.getElementById('shareButton');
	if (!shareBtn) {
		shareBtn = document.createElement('button');
		shareBtn.id = 'shareButton';
		shareBtn.innerHTML = `
			<div style="display: flex; align-items: center; gap: 8px;">
				<span style="font-size: 16px; line-height: 1;">📱</span>
				<span style="letter-spacing: 1px;">SHARE STORY</span>
			</div>
		`;
		shareBtn.style.cssText = `
			position: fixed;
			left: 50%;
			transform: translateX(-50%);
			bottom: 100px;
			padding: 12px 24px;
			background: #2D2D2D;
			color: #00FF66;
			border: 2px solid #00FF66;
			border-radius: 0;
			font-size: 14px;
			font-weight: 700;
			cursor: pointer;
			z-index: 9999;
			font-family: 'Press Start 2P', system-ui, monospace;
			box-shadow: 
				0 0 10px rgba(0, 255, 102, 0.3),
				inset 0 0 10px rgba(0, 255, 102, 0.2);
			text-transform: uppercase;
			animation: slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
			clip-path: polygon(
				0 0,
				calc(100% - 8px) 0,
				100% 8px,
				100% calc(100% - 8px),
				calc(100% - 8px) 100%,
				8px 100%,
				0 calc(100% - 8px),
				0 8px
			);
		`;

		// Добавляем keyframes для анимации
		const style = document.createElement('style');
		style.textContent = `
			@keyframes slideUp {
				from {
					transform: translate(-50%, 100%);
					opacity: 0;
				}
				to {
					transform: translate(-50%, 0);
					opacity: 1;
				}
			}

			@keyframes glitch {
				0% {
					text-shadow: 
						0.05em 0 0 rgba(255, 0, 0, .75),
						-0.025em -0.05em 0 rgba(0, 255, 0, .75),
						0.025em 0.05em 0 rgba(0, 0, 255, .75);
				}
				14% {
					text-shadow: 
						0.05em 0 0 rgba(255, 0, 0, .75),
						-0.025em -0.05em 0 rgba(0, 255, 0, .75),
						0.025em 0.05em 0 rgba(0, 0, 255, .75);
				}
				15% {
					text-shadow: 
						-0.05em -0.025em 0 rgba(255, 0, 0, .75),
						0.025em 0.025em 0 rgba(0, 255, 0, .75),
						-0.05em -0.05em 0 rgba(0, 0, 255, .75);
				}
				49% {
					text-shadow: 
						-0.05em -0.025em 0 rgba(255, 0, 0, .75),
						0.025em 0.025em 0 rgba(0, 255, 0, .75),
						-0.05em -0.05em 0 rgba(0, 0, 255, .75);
				}
				50% {
					text-shadow: 
						0.025em 0.05em 0 rgba(255, 0, 0, .75),
						0.05em 0 0 rgba(0, 255, 0, .75),
						0 -0.05em 0 rgba(0, 0, 255, .75);
				}
				99% {
					text-shadow: 
						0.025em 0.05em 0 rgba(255, 0, 0, .75),
						0.05em 0 0 rgba(0, 255, 0, .75),
						0 -0.05em 0 rgba(0, 0, 255, .75);
				}
				100% {
					text-shadow: 
						-0.025em 0 0 rgba(255, 0, 0, .75),
						-0.025em -0.025em 0 rgba(0, 255, 0, .75),
						-0.025em -0.05em 0 rgba(0, 0, 255, .75);
				}
			}

			#shareButton {
				position: relative;
				isolation: isolate;
			}

			#shareButton:hover {
				background: #00FF66;
				color: #2D2D2D;
				box-shadow: 
					0 0 20px rgba(0, 255, 102, 0.5),
					inset 0 0 20px rgba(0, 0, 0, 0.2);
			}

			#shareButton:hover span {
				animation: glitch 1s infinite linear;
			}

			#shareButton::before {
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: linear-gradient(
					45deg,
					transparent 0%,
					rgba(0, 255, 102, 0.1) 45%,
					rgba(0, 255, 102, 0.2) 50%,
					rgba(0, 255, 102, 0.1) 55%,
					transparent 100%
				);
				transform: translateX(-100%);
				transition: transform 0.5s;
				z-index: -1;
			}

			#shareButton:hover::before {
				transform: translateX(100%);
			}
		`;
		document.head.appendChild(style);

		// Добавляем эффект пульсации
		let pulseTimeout;
		const startPulse = () => {
			shareBtn.style.transform = 'translateX(-50%) scale(1.05)';
			setTimeout(() => {
				shareBtn.style.transform = 'translateX(-50%) scale(1)';
			}, 200);
		};

		pulseTimeout = setInterval(startPulse, 3000);

		// Очищаем интервал при клике
		shareBtn.onclick = function() {
			clearInterval(pulseTimeout);
			if (window.Telegram?.WebApp) {
				const username = window.Telegram.WebApp.initDataUnsafe?.user?.username || 'Player';
				
				// Получаем реферальную ссылку
				fetch(`/get-referral-link?telegramId=${window.Telegram.WebApp.initDataUnsafe.user.id}`, {
					headers: {
						'x-telegram-init-data': window.Telegram.WebApp.initData
					}
				})
				.then(response => response.json())
				.then(data => {
					if (data.inviteLink) {
						// Используем полученную реферальную ссылку
						window.Telegram.WebApp.shareToStory(
							'https://pandapp.ru/assets/icon.png',
							{
								text: `🎮 ${username} scored ${lastScore} points in TimberPanda!\n\n🎯 Can you beat this score?`,
								widget_link: {
									url: data.inviteLink,
									name: 'Play TimberPanda'
								}
							}
						);
					}
				})
				.catch(error => console.error('Error getting referral link:', error));
			}
		};

		document.body.appendChild(shareBtn);
	} else {
		shareBtn.style.display = 'block';
	}

	// Отображаем счет
	for (var i = 0; i < score.toString().length; i++) {
		let digit = parseInt(score.toString()[i]);
		let m = screenWidth()/2 - 35 * score.toString().length;
		displaySprite(number[digit], m + 67 * i, 700);
	}
}

function renderGame() {
	const canvas = document.getElementById('game');
	if (!canvas) {
		console.log('Canvas not found, stopping game');
		return;
	}

	// Создаем кнопку звука при первом рендере
	if (window.gameAudio && !document.getElementById('soundButton')) {
		window.gameAudio.createSoundButton();
	}

	clearScreen("black");
	
	// Display Background
	displaySprite(background, 0, 0);
	
	// Display Trunk
	displaySprite(stump, 352, 1394);	
	for(var i = 0; i < 6; i++) {
		displaySprite(trunk[i], 37, stump.y - TrunkHeight * (i+2) + TrunkHeight);
	}
		
	// Display Timberman	
	if (level == levelPlay) {
		displaySprite(man, man.x, 1270);
	}
	
	// Display Level Load 
	if (level == levelLoad) {
		displaySprite(man, man.x, 1270);
		displaySprite(left, 250, 1020);
		displaySprite(or, 450, 1300);
		displaySprite(right, 580, 1020);
		displaySprite(clic, 300, 1500);
	}
	
	// Display Level Game Over
	if (level == levelGameOver) {
		displaySprite(rip, man.x, 1240);
		displaySprite(gameover, 110, -250);
		displaySprite(play, 350, 800);
		
		// Отображаем best score
		for (var i=0; i < bestscore.toString().length; i++) {
			p = bestscore.toString().substring(i, i+1)
			m = screenWidth()/2 - 35 * bestscore.toString().length
			displaySprite(number[p], m + 67 * i, 480)
		}
	}

	// Display Progress Bar
	if (level == levelPlay) {
		if (timescore > 0) {
			timescore -= levelscore/15;
		} else {
			gameOver();
			level = levelGameOver;
		}
		displaySprite(timecontainer, 255, 100);
		displaySprite(timebar, 285, 130, timescore);
	}
	
	// Display Score - для всех состояний игры
	if (level == levelPlay || level == levelGameOver) {
		let scoreStr = level == levelGameOver ? lastScore.toString() : score.toString();
		for (var i = 0; i < scoreStr.length; i++) {
			let digit = parseInt(scoreStr[i]);
			let m = screenWidth()/2 - 35 * scoreStr.length;
			displaySprite(number[digit], m + 67 * i, 700);
		}
	}
	
	// Animation status
	if (animationActive(man, "cut") === false) {
		playAnimation(man, "breath"); 
	} else {
		playAnimation(man, "cut")	
	}
	
	// Evenements clavier et souris 
	if (keyboardReleased(KEY_LEFT) && level != levelGameOver) {
		man.data = "left";
		man.x = 263;
		flipSprite(man, 1, 1);
		man.action = true;		
	}

	if (keyboardReleased(KEY_RIGHT) && level != levelGameOver) {
		man.data = "right";
		man.x = 800;
		flipSprite(man, -1, 1);
		man.action = true;
	}

	if (keyboardReleased(KEY_ENTER) && level == levelGameOver) {
		restartGame();
		level =levelLoad;
	}
	 
	if (mouseButton() == true) {
		switch (level) {
			case levelMenu:
				level = levelLoad;
				break;
				
			case levelLoad:
				if (mouseX() <= screenWidth()/2) {
					man.data = "left";
					man.x = 263;
					flipSprite(man, 1, 1);
				} else {
					man.data = "right";
					man.x = 800;
					flipSprite(man, -1, 1);
				}
				man.action = true;
				break;
    
			case levelPlay:
				if ( mouseX() <= screenWidth()/2 ) {
					man.data = "left"
					man.x = 263;
					flipSprite(man, 1, 1);
				} else {
					man.data = "right"
					man.x = 800;
					flipSprite(man, -1, 1);
				}
				man.action = true;
				break;
				
			case levelGameOver:
				// Проверяем клик по кнопке Share
				if (mouseY() >= 900 && mouseY() <= 1000 && mouseX() >= 300 && mouseX() <= 400) {
					shareScore();
				}
				// Проверяем клик по кнопке Play (существующий функционал)
				else if (mouseY() >= 750 && mouseY() <= 850 && mouseX() >= 300 && mouseX() <= 400) {
					restartGame();
					level = levelLoad;
				}
				break;
		}
	}
	
	// Action
	if (man.action == true) {
		if (level == levelLoad) {
			level = levelPlay;
		}

		// Воспроизводим звук рубки
		playCutSound();

		// Анимация рубки
		playAnimation(man, "cut")		
				
		// Est ce une branche qui pourrait heurter le bucheron
		if (man.data == "left" && trunk[0].data == "branchleft" || man.data == "right" && trunk[0].data == "branchright") {
			gameOver()
		} 
				
		// Mise à jour du scrore 
		score++;
		if (score % 20 == 0 ) {
			levelscore ++;
		}
				
		if (timescore < 508) {
			timescore += 10;
		}
			
		// Chaque tronon de l'arbre descend d'un niveau
		for(var i = 0; i < 6; i++) {
			trunk[i] = trunk[i+1];	
		}	
				
		// Suppression du tronon le plus haut
		trunk[6] = 0;
				
		// Ajout d'un nouveau tronon
		addTrunk();										
				
		// Une fois le tronc coupé, on vérifie si le tronc qui retombe n'est pas une branche qui pourrait heurter le bucheron
		if (man.data == "left" && trunk[0].data == "branchleft" || man.data == "right" && trunk[0].data == "branchright") {
			gameOver();
		} 	
		man.action = false;
	}
	requestAnimationFrame(renderGame);
};

// Функция для шаринга в сторис
function shareScore() {
	if (window.Telegram?.WebApp) {
		const text = `🎮 I scored ${lastScore} points in Timberman!\n\n🌲 Can you beat my score?\n\n🎯 Play now:`;
		const url = 'https://pandapp.ru'; // Замените на ваш URL

		window.Telegram.WebApp.switchInlineQuery(text, ['users', 'groups', 'channels']);
	}
}

// Функция очистки при выходе из игры
function cleanupGame() {
	if (window.gameAudio) {
		// Останавливаем все звуки
		window.gameAudio.deathSound.pause();
		window.gameAudio.deathSound.currentTime = 0;
		window.gameAudio.cutSound.pause();
		window.gameAudio.cutSound.currentTime = 0;
	}
	
	// Удаляем кнопку звука при очистке
	const soundButton = document.getElementById('soundButton');
	if (soundButton) {
		soundButton.remove();
	}
	
	// ... остальной код очистки ...
}