const https = require('https');  
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
const crypto = require('crypto');
require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const url = require('url');


// Редис для уведомлений
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
const Redis = require('ioredis');
const redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
    retryStrategy: function(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: null
});

redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});

redis.on('connect', () => {
    console.log('Successfully connected to Redis');
});
const schedule = require('node-schedule');
const isAdmin = (telegramId) => {
  return telegramId.toString() === ADMIN_ID;
};

// Создаем подключение к базе данных
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD, 
  {
      host: process.env.DB_HOST,
      dialect: process.env.DB_DIALECT
  }
);

// Определяем модель User
const User = sequelize.define('User', {
  telegramId: {
    type: DataTypes.BIGINT, // Изменить тип с STRING на BIGINT
    allowNull: false,
    unique: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referralCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  referredBy: {
    type: DataTypes.STRING,
    allowNull: true
  },
  referralRewardsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  totalBalance: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  taskBalance: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  inviteBalance: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  purchasedModes: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [], 
    allowNull: false
  },
  adWatchCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  lastAdUniqueId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastAdWatchTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  highScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  }
});

// Синхронизируем модель с базой данных
sequelize.sync({ alter: true });
// Создаем экземпляр бота с вашим токеном
const bot = new Telegraf(process.env.PANDA_BOT_TOKEN);
// WebApp URL
const webAppUrl = 'https://pandapp.ru';

// Обработчик команды /start
bot.command('start', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  // Используем first_name если username отсутствует
  const username = ctx.from.username || ctx.from.first_name || `user_${telegramId}`;
  const referralCode = ctx.message.text.split(' ')[1];

  try {
    let user = await User.findOne({ where: { telegramId } });

    if (!user) {
      const newReferralCode = crypto.randomBytes(4).toString('hex');
      
      user = await User.create({
        telegramId,
        username,
        referralCode: newReferralCode,
        referredBy: referralCode || null
      });

      if (referralCode) {
        const referrer = await User.findOne({ where: { referralCode } });
        if (referrer) {
          console.log(`User ${telegramId} was referred by ${referrer.telegramId}`);
        }
      }
    } else {
      // Обновляем username если он изменился
      if (user.username !== username) {
        await user.update({ username });
      }
      
      // Если пользователь уже существует, но не имеет реферера и предоставлен реферальный код
      if (!user.referredBy && referralCode) {
        const referrer = await User.findOne({ where: { referralCode } });
        if (referrer && referrer.telegramId !== telegramId) { // Проверяем что это не самореферал
          await user.update({ referredBy: referralCode });
          console.log(`Existing user ${telegramId} was referred by ${referrer.telegramId}`);
        }
      }
    }

    ctx.reply('🐼 Welcome to TimberPanda Game! 🎮\n\n' + 
      '🌟 Dive into the exciting world of TimberPanda:\n' +
      '🪓 Cut trees with our adorable panda\n' +
      '🏆 Set new high scores\n' +
      '🎯 Challenge your skills\n\n' +
      '💰 Earn PandaCoins in multiple ways:\n' +
      '🎮 Play and earn coins for each game\n' +
      '🔥 Break records and get bonus rewards\n' +
      '👥 Invite friends and earn together\n\n' +
      '✨ Game Features:\n' +
      '📊 Global leaderboard system\n' +
      '🎁 Daily rewards and bonuses\n' +
      '🔄 Different game modes to unlock\n' +
      '👬 Referral rewards system\n\n' +
      '🚀 Ready to become a TimberPanda master?\n' +
      '👉 Open Web App to start playing!', {
      reply_markup: {
        resize_keyboard: true
      }
    });

  } catch (error) {
    console.error('Error in start command:', error);
    ctx.reply('An error occurred. Please try again later.');
  }
});

// Запускаем бота
bot.launch();
bot.on('pre_checkout_query', async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
  } catch (error) {
    console.error('Error in pre_checkout_query:', error);
  }
});

// Обработка successful_payment
bot.on('successful_payment', async (ctx) => {
  try {
    const payment = ctx.message.successful_payment;
    const [type, telegramId, modeName] = payment.invoice_payload.split('_');

    if (type === 'mode') {
      const user = await User.findOne({ where: { telegramId } });
      if (!user) {
        console.error('User not found:', telegramId);
        return;
      }

      // Добавляем новый режим
      const updatedModes = [...new Set([...user.purchasedModes, modeName])];
      await user.update({ purchasedModes: updatedModes });

      await ctx.reply('✨ Mode upgraded successfully! You can now use the new mode.');
    }
  } catch (error) {
    console.error('Error in successful_payment:', error);
  }
});

function validateInitData(initData) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  
  // Сортируем оставшиеся параметры
  const params = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
    
  // Создаем HMAC
  const secret = crypto.createHmac('sha256', 'WebAppData')
    .update(process.env.PANDA_BOT_TOKEN)
    .digest();
    
  const generatedHash = crypto.createHmac('sha256', secret)
    .update(params)
    .digest('hex');
    
  return generatedHash === hash;
}

async function authMiddleware(req, res) {
  const initData = req.headers['x-telegram-init-data'];
  if (!initData || !validateInitData(initData)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }
  return null;
}
const routes = {
  GET: {
    '/get-user': async (req, res, query) => {
  const telegramId = query.telegramId;
  
  if (!telegramId) {
    return { 
      status: 400, 
      body: { error: 'Telegram ID is required' } 
    };
  }

  try {
    let user = await User.findOne({ where: { telegramId } });
    
    if (user) {
      // Проверяем наличие реферального кода
      if (!user.referralCode) {
        const newReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await user.update({ referralCode: newReferralCode });
        user = await User.findOne({ where: { telegramId } }); // Получаем обновленного пользователя
      }

      return { 
        status: 200, 
        body: {
          success: true,
          user: {
            id: user.id,
            telegramId: user.telegramId,
            username: user.username,
            referralCode: user.referralCode,
            rootBalance: user.rootBalance,
            referredBy: user.referredBy
          }
        }
      };
    }

    return { 
      status: 404, 
      body: { 
        success: false,
        error: 'User not found' 
      } 
    };
  } catch (error) {
    console.error('Error getting user:', error);
    return { 
      status: 500, 
      body: { error: 'Failed to get user' } 
    };
  }
},
    '/get-balances': async (req, res, query) => {
    const telegramId = query.telegramId;
    console.log('Get balances request for user:', telegramId);
    
    if (!telegramId) {
        console.log('Missing telegramId parameter');
        return { status: 400, body: { error: 'Missing telegramId parameter' } };
    }

    try {
        const user = await User.findOne({ where: { telegramId } });
        console.log('Found user:', user ? user.dataValues : null);
        
        if (!user) {
            console.log('User not found:', telegramId);
            return { status: 404, body: { error: 'User not found' } };
        }

        const balances = {
            totalBalance: user.totalBalance,
            taskBalance: user.taskBalance,
            inviteBalance: user.inviteBalance
        };
        
        console.log('Returning balances:', balances);
        
        return {
            status: 200,
            body: {
                success: true,
                balances
            }
        };
    } catch (error) {
        console.error('Error getting balances:', error);
        return { status: 500, body: { error: 'Internal server error' } };
    }
},
    '/get-referral-link': async (req, res, query) => {
      console.log('Получен запрос на /get-referral-link');
      const telegramId = query.telegramId;
      
      if (!telegramId) {
        console.log('Отсутствует telegramId');
        return { status: 400, body: { error: 'Missing telegramId parameter' } };
      }

      try {
        console.log('Поиск пользователя с telegramId:', telegramId);
        const user = await User.findOne({ where: { telegramId } });
        if (user) {
          const inviteLink = `https://t.me/pandapp_gamebot?start=${user.referralCode}`;
          console.log('Сгенерирована ссылка:', inviteLink);
          return { status: 200, body: { inviteLink } };
        } else {
          console.log('Пользователь не найден');
          return { status: 404, body: { error: 'User not found' } };
        }
      } catch (error) {
        console.error('Ошибка при обработке запроса:', error);
        return { status: 500, body: { error: 'Internal server error' } };
      }
    },
    '/get-referral-count': async (req, res, query) => {
      const authError = await authMiddleware(req, res);
      if (authError) return authError;

      console.log('Request query:', query);
      console.log('Request URL:', req.url);
      
      // Используем query.telegramId
      const telegramId = query?.telegramId;
      
      if (!telegramId) {
        console.error('No telegramId provided in request');
        return { 
          status: 400, 
          body: { 
            success: false, 
            error: 'Telegram ID is required' 
          } 
        };
      }

      try {
        const user = await User.findOne({ where: { telegramId } });
        console.log('Found user:', user);

        if (!user) {
          return { 
            status: 404, 
            body: { 
              success: false, 
              error: 'User not found' 
            } 
          };
        }

        // Получаем список рефералов
        const referrals = await User.findAll({
          where: { referredBy: user.referralCode },
          attributes: ['telegramId', 'username', 'createdAt'],
          raw: true
        });

        console.log('Found referrals:', referrals);

        // Форматируем данные
        const formattedReferrals = referrals.map(ref => ({
          id: ref.telegramId,
          username: ref.username || `User_${ref.telegramId}`,
          joinDate: ref.createdAt,
          dps: 100
        }));

        return {
          status: 200,
          body: {
            success: true,
            referrals: formattedReferrals
          }
        };
      } catch (error) {
        console.error('Error in get-referral-count:', error);
        return { 
          status: 500, 
          body: { 
            success: false, 
            error: 'Server error' 
          } 
        };
      }
    },
'/create-mode-invoice': async (req, res, query) => {
    const { telegramId, modeName } = query;
    
    if (!telegramId || !modeName) {
        return { status: 400, body: { error: 'Missing required parameters' } };
    }

    const modePrices = {
        'basic': 100,
        'advanced': 250,
        'expert': 500
    };

    try {
        const user = await User.findOne({ where: { telegramId } });
        if (!user) {
            return { status: 404, body: { error: 'User not found' } };
        }

        if (user.purchasedModes.includes(modeName)) {
            return { status: 400, body: { error: 'Mode already purchased' } };
        }

        const invoice = await bot.telegram.createInvoiceLink({
            title: 'ROOTBTC Mode Upgrade',
            description: `Upgrade to ${modeName.charAt(0).toUpperCase() + modeName.slice(1)} mode`,
            payload: `mode_${telegramId}_${modeName}`,
            provider_token: "",
            currency: 'XTR',
            prices: [{
                label: '⭐️ Mode Upgrade',
                amount: parseInt(modePrices[modeName]) // Исправлено здесь
            }]
        });

        return { status: 200, body: { slug: invoice } };
    } catch (error) {
        console.error('Error creating mode invoice:', error);
        return { status: 500, body: { error: 'Failed to create invoice' } };
    }
},
    '/update-user-modes': async (req, res, query) => {
    const { telegramId, modeName } = query;
    
    if (!telegramId || !modeName) {
        return { status: 400, body: { error: 'Missing required parameters' } };
    }

    try {
        const user = await User.findOne({ where: { telegramId } });
        if (!user) {
            return { status: 404, body: { error: 'User not found' } };
        }

        const updatedModes = [...new Set([...user.purchasedModes, modeName])];
        await user.update({ purchasedModes: updatedModes });

        return { 
            status: 200, 
            body: { 
                success: true,
                purchasedModes: updatedModes
            }
        };
    } catch (error) {
        console.error('Error updating user modes:', error);
        return { status: 500, body: { error: 'Failed to update user modes' } };
    }
},

    '/get-user-modes': async (req, res, query) => {
    const { telegramId } = query;
    
    if (!telegramId) {
        return { status: 400, body: { error: 'Missing telegramId parameter' } };
    }

    try {
        const user = await User.findOne({ where: { telegramId } });
        if (!user) {
            return { status: 404, body: { error: 'User not found' } };
        }

        return { 
            status: 200, 
            body: { 
                purchasedModes: user.purchasedModes 
            }
        };
    } catch (error) {
        console.error('Error getting user modes:', error);
        return { status: 500, body: { error: 'Failed to get user modes' } };
    }
},
    '/get-friends-leaderboard': async (req, res, query) => {
    const telegramId = query.telegramId;
    
    if (!telegramId) {
        return { status: 400, body: { error: 'Missing telegramId parameter' } };
    }

    try {
        // Получаем текущего пользователя
        const currentUser = await User.findOne({ 
            where: { telegramId },
            attributes: ['telegramId', 'username', 'highScore']
        });

        if (!currentUser) {
            return { status: 404, body: { error: 'User not found' } };
        }

        // Получаем топ-10 игроков с наивысшими рекордами
        const topPlayers = await User.findAll({
            where: {
                highScore: {
                    [Sequelize.Op.gt]: 0
                }
            },
            attributes: ['telegramId', 'username', 'highScore'],
            order: [['highScore', 'DESC']],
            limit: 10  // Уменьшаем лимит до 10
        });

        // Преобразуем данные и добавляем позицию
        const leaderboardData = topPlayers.map((player, index) => ({
            position: index + 1,
            id: player.telegramId,
            username: player.username || 'Anonymous',
            highScore: player.highScore,
            isCurrentUser: player.telegramId === telegramId
        }));

        // Если текущий пользователь не в топ-10, добавляем его отдельно
        if (!leaderboardData.some(player => player.isCurrentUser)) {
            leaderboardData.push({
                id: currentUser.telegramId,
                username: currentUser.username || 'Anonymous',
                highScore: currentUser.highScore,
                isCurrentUser: true
            });
        }

        return { 
            status: 200, 
            body: { 
                success: true,
                leaderboard: leaderboardData,
                timestamp: Date.now()
            } 
        };
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        return { 
            status: 500, 
            body: { 
                success: false,
                error: 'Internal server error' 
            } 
        };
    }
},
'/reward': async (req, res, query) => {
  const telegramId = query.userid;
  
  if (!telegramId) {
      return { status: 400, body: { error: 'Missing userid parameter' } };
  }

  try {
      const user = await User.findOne({ where: { telegramId } });
      if (!user) {
          return { status: 404, body: { error: 'User not found' } };
      }

      await user.update({
          adWatchCount: (user.adWatchCount || 0) + 1
      });

      return { status: 200, body: { 
          success: true, 
          message: 'Ad view recorded',
          adWatchCount: user.adWatchCount + 1
      }};
  } catch (error) {
      console.error('Error in reward endpoint:', error);
      return { status: 500, body: { error: 'Internal server error' } };
  }
},

'/get-leaderboard': async (_, res) => {
  try {
      const leaderboard = await User.findAll({
          attributes: ['telegramId', 'username', 'highScore'],
          order: [['highScore', 'DESC']],
          limit: 10,
          raw: true
      });

      return {
          status: 200,
          body: {
              success: true,
              leaderboard: leaderboard.map(player => ({
                  telegramId: String(player.telegramId),
                  username: player.username || 'Anonymous',
                  highScore: Number(player.highScore || 0)
              }))
          }
      };
  } catch (error) {
      console.error('Leaderboard error:', error);
      return {
          status: 500,
          body: {
              success: false,
              error: 'Could not fetch leaderboard'
          }
      };
  }
},
'/create-story': async (req, res, query) => {
    const { telegramId, score } = query;
    
    if (!telegramId || !score) {
        return { 
            status: 400, 
            body: { error: 'Missing required parameters' } 
        };
    }

    try {
        const user = await User.findOne({ where: { telegramId } });
        if (!user) {
            return { 
                status: 404, 
                body: { error: 'User not found' } 
            };
        }

        // Отправляем команду для создания истории
        await bot.telegram.sendMessage(telegramId, 'Share your achievement!', {
            reply_markup: {
                inline_keyboard: [[{
                    text: '📱 Share Story',
                    callback_data: JSON.stringify({
                        action: 'create_story',
                        score: score,
                        username: user.username
                    })
                }]]
            }
        });

        return {
            status: 200,
            body: { 
                success: true,
                message: 'Story creation dialog sent' 
            }
        };
    } catch (error) {
        console.error('Error creating story:', error);
        return { 
            status: 500, 
            body: { error: 'Failed to create story' } 
        };
    }
}
},
    POST: {
      '/update-balances': async (req, res) => {
        const authError = await authMiddleware(req, res);
        if (authError) return authError;
        
        return new Promise((resolve) => {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              console.log('Received update-balances data:', data);
              
              const { telegramId, amount, type } = data;
              
              if (!telegramId || !amount || !type) {
                console.error('Missing required parameters:', { telegramId, amount, type });
                resolve({
                  status: 400,
                  body: { 
                    success: false,
                    error: 'Missing required parameters' 
                  }
                });
                return;
              }

              const user = await User.findOne({ where: { telegramId: telegramId.toString() } });
              if (!user) {
                resolve({
                  status: 404,
                  body: { 
                    success: false,
                    error: 'User not found' 
                  }
                });
                return;
              }

              // Обновляем балансы в зависимости от типа
              let updates = {};
              
              if (type === 'game') {
                updates.totalBalance = user.totalBalance + parseInt(amount);
              } else if (type === 'invite') {
                updates.totalBalance = user.totalBalance + parseInt(amount);
                updates.inviteBalance = user.inviteBalance + parseInt(amount);
              } else if (type === 'task') {
                updates.totalBalance = user.totalBalance + parseInt(amount);
                updates.taskBalance = user.taskBalance + parseInt(amount);
              }

              await user.update(updates);

              // Получаем обновленного пользователя
              const updatedUser = await User.findOne({ where: { telegramId: telegramId.toString() } });

              resolve({
                status: 200,
                body: {
                  success: true,
                  balances: {
                    total: updatedUser.totalBalance,
                    task: updatedUser.taskBalance,
                    invite: updatedUser.inviteBalance
                  }
                }
              });

            } catch (error) {
              console.error('Error updating balances:', error);
              resolve({
                status: 500,
                body: { 
                  success: false,
                  error: 'Internal server error' 
                }
              });
            }
          });
        });
      },
      '/create-user': async (req, res) => {
  const authError = await authMiddleware(req, res);
  if (authError) return authError;

  let body = '';
  req.on('data', chunk => { body += chunk; });
  
  return new Promise((resolve) => {
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { telegramId, username, referralCode, referredBy } = data;
        
        console.log('Creating user with data:', {
          telegramId,
          username,
          referralCode,
          referredBy
        });

        if (!telegramId || !referralCode) {
          resolve({ 
            status: 400, 
            body: { error: 'Telegram ID and referral code are required' } 
          });
          return;
        }

        // Проверяем существующего пользователя
        let user = await User.findOne({ where: { telegramId } });
        console.log('Existing user:', user);
        
        if (user) {
          resolve({
            status: 200,
            body: {
              success: true,
              user: {
                id: user.id,
                telegramId: user.telegramId,
                username: user.username,
                referralCode: user.referralCode,
                referredBy: user.referredBy
              }
            }
          });
          return;
        }

        // Проверяем реферальный код если он есть
        if (referredBy) {
          const referrer = await User.findOne({ 
            where: { referralCode: referredBy } 
          });
          console.log('Found referrer:', referrer);
          
          if (referrer) {
            console.log(`User ${telegramId} was referred by ${referrer.telegramId}`);
          }
        }

        // Создаем нового пользователя
        user = await User.create({
          telegramId,
          username,
          referralCode,
          referredBy: referredBy || null
        });

        console.log('Created new user:', user);

        resolve({
          status: 200,
          body: {
            success: true,
            user: {
              id: user.id,
              telegramId: user.telegramId,
              username: user.username,
              referralCode: user.referralCode,
              referredBy: user.referredBy
            }
          }
        });
      } catch (error) {
        console.error('Error creating user:', error);
        resolve({ 
          status: 500, 
          body: { error: 'Failed to create user' } 
        });
      }
    });
  });
},
'/admin/broadcast': async (req, res) => {
  const authError = await authMiddleware(req, res);
  if (authError) return authError;
  
  let body = '';
  req.on('data', chunk => { body += chunk; });
  
  return new Promise((resolve) => {
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const adminId = data.adminId.toString();
        
        if (!isAdmin(adminId)) {
          resolve({
            status: 403,
            body: { error: 'Unauthorized: Admin access required' }
          });
          return;
        }

        const { message, button } = data;
        const users = await User.findAll();
        const results = {
          total: users.length,
          success: 0,
          failed: 0
        };

        for (const user of users) {
          try {
            const messageData = {
              chat_id: user.telegramId,
              text: message,
              parse_mode: 'HTML'
            };

            if (button) {
              messageData.reply_markup = {
                inline_keyboard: [[{
                  text: button.text,
                  web_app: { url: button.url }
                }]]
              };
            }

            await bot.telegram.sendMessage(
              user.telegramId,
              message,
              messageData
            );
            results.success++;
          } catch (error) {
            console.error(`Failed to send message to ${user.telegramId}:`, error);
            results.failed++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        resolve({
          status: 200,
          body: { 
            success: true,
            results
          }
        });
      } catch (error) {
        console.error('Error in broadcast:', error);
        resolve({ 
          status: 500, 
          body: { error: 'Internal server error: ' + error.message }
        });
      }
    });
  });
},
    '/update-high-score': async (req, res) => {
      let body = '';
      
      req.on('data', chunk => {
        body += chunk.toString();
      });
      
      return new Promise((resolve) => {
        req.on('end', async () => {
          try {
            console.log('Received score update body:', body);
            
            const data = JSON.parse(body);
            console.log('Parsed score data:', data);
            
            const { telegramId, highScore } = data;
            
            if (!telegramId || typeof highScore !== 'number') {
              resolve({
                status: 400,
                body: { 
                  success: false,
                  error: 'Invalid input data'
                }
              });
              return;
            }
            
            const user = await User.findOne({ 
              where: { telegramId: telegramId.toString() } 
            });
            
            if (!user) {
              resolve({
                status: 404,
                body: {
                  success: false,
                  error: 'User not found'
                }
              });
              return;
            }
            
            if (highScore > (user.highScore || 0)) {
              await user.update({ highScore });
              console.log(`Updated highScore for ${telegramId} to ${highScore}`);
            }
            
            resolve({
              status: 200,
              body: {
                success: true,
                highScore: Math.max(user.highScore || 0, highScore)
              }
            });
            
          } catch (error) {
            console.error('Error processing score update:', error);
            resolve({
              status: 400,
              body: {
                success: false,
                error: error.message
              }
            });
          }
        });
      });
    },
    '/check-subscription': async (req, res) => {
      const authError = await authMiddleware(req, res);
      if (authError) return authError;

      return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const { telegramId, channelUsername } = data;
            
            if (!telegramId || !channelUsername) {
              resolve({
                status: 400,
                body: { 
                  success: false,
                  error: 'Missing required parameters' 
                }
              });
              return;
            }

            // Добавляем задержку перед проверкой
            await new Promise(resolve => setTimeout(resolve, 2000));

            async function checkMembership(telegramId, channelUsername) {
              try {
                // Пробуем сначала получить информацию о канале
                const chat = await bot.telegram.getChat('@' + channelUsername)
                  .catch(err => {
                    console.log(`Info: Cannot get chat info for ${channelUsername}, trying direct membership check`);
                    return null;
                  });

                // Проверяем членство пользователя
                try {
                  const member = await bot.telegram.getChatMember('@' + channelUsername, telegramId);
                  const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
                  return isSubscribed;
                } catch (err) {
                  // Если не удалось проверить напрямую, пробуем альтернативный метод
                  if (err.message.includes('member list is inaccessible')) {
                    console.log(`Info: Using alternative check method for ${channelUsername}`);
                    try {
                      // Пробуем отправить служебное действие в чат
                      await bot.telegram.sendChatAction('@' + channelUsername, 'typing');
                      return true; // Если удалось отправить действие, значит пользователь подписан
                    } catch (actionErr) {
                      if (actionErr.message.includes('bot is not a member')) {
                        console.log(`Warning: Bot needs to be added to ${channelUsername}`);
                      }
                      return false;
                    }
                  }
                  console.log(`Info: User ${telegramId} is not subscribed to ${channelUsername}`);
                  return false;
                }
              } catch (error) {
                // Логируем ошибку, но не как критическую
                console.log(`Info: Alternative check failed for ${channelUsername}:`, error.message);
                return false;
              }
            }

            const isSubscribed = await checkMembership(telegramId, channelUsername);
            
            console.log(`Subscription check result for user ${telegramId} in channel ${channelUsername}: ${isSubscribed}`);
            
            resolve({
              status: 200,
              body: { 
                success: true,
                isSubscribed 
              }
            });
          } catch (error) {
            console.error('Error processing subscription check:', error);
            resolve({
              status: 200,
              body: { 
                success: true,
                isSubscribed: false 
              }
            });
          }
        });
      });
    }
  }
};


// Функция для обработки статических файлов
const serveStaticFile = (filePath, res) => {
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  }[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
};

const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/walletfinder.ru/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/walletfinder.ru/fullchain.pem')
};
//
const server = https.createServer(options, async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log('Received request:', {
    method,
    pathname,
    query: parsedUrl.query
  });

  if (routes[method] && routes[method][pathname]) {
    const handler = routes[method][pathname];
    try {
      const result = await handler(req, res, parsedUrl.query);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch (error) {
      console.error('Error handling request:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  } else {
    let filePath = path.join(__dirname, 'dist', req.url === '/' ? 'index.html' : req.url);
    serveStaticFile(filePath, res);
  }
});

const httpsPort = 888;
const httpPort = 887;

server.listen(httpsPort, () => {
  console.log(`HTTPS Сервер запущен на порту ${httpsPort}`);
  console.log('Telegram бот запущен');
  console.log(`HTTPS Сервер запущен на https://pandapp.ru.ru`);
});

// HTTP to HTTPS redirect
http.createServer((req, res) => {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
  res.end();
}).listen(httpPort, () => {
  console.log(`HTTP сервер запущен на порту ${httpPort} для перенаправления на HTTPS`);
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Добавьте этот обработчик где-то после создания бота
bot.on('callback_query', async (ctx) => {
    try {
        const data = JSON.parse(ctx.callbackQuery.data);
        if (data.action === 'create_story') {
            await ctx.telegram.sendStory(ctx.from.id, {
                background_type: 'gradient',
                background: {
                    colors: ['#223522', '#4CAF50'],
                    rotation: 45
                },
                text: `🎮 ${data.username}\n\n⭐️ Scored ${data.score} points\nin TimberPanda!\n\n🎯 Can you beat this?`,
                text_color: '#FFFFFF'
            });
            await ctx.answerCallbackQuery('Creating story...');
        }
    } catch (error) {
        console.error('Error in callback query:', error);
        await ctx.answerCallbackQuery('Failed to create story');
    }
});
