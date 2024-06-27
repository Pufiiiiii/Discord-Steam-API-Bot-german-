const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9'); 
require('dotenv').config();

const commands = [
 
    {
        name: 'gamestats',
        description:'Schau dir die Stats an!',
        options: [
            {
              name: 'game',
              type: 3,
              description: 'Suche:',
              required: true,
            },
              ]
      },
      {
        name: 'spielzeit',
        description:'Schau dir die Stats an!',
        options: [
            {
                name: 'steamid',
                type: 3,
                description: 'Suche:',
                required: true,
              },
  
            {
              name: 'game',
              type: 3,
              description: 'Suche:',
              required: true,
            },
              ]
      },
      {
        name: 'hilfe',
        description: 'Zeigt dir alle Commands an :D'
      },
      {
        name: 'gesamte_spielzeit',
        description:'Schau dir die Stats an!',
        options: [
            {
                name:'steamid',
                type: 3,
                description: 'Suche:',
                required: true,
            }
        ]
      
      },
      {
        name: 'anmelden_für_steam',
        description: 'Hier könnt Ihre eure Steam User ID registrieren',
          options: [
            {
              name: 'steamid',
              type: 3,
              description: 'SteamID hier eingeben ihr Affen',
              required: true,
            }
          ]
      },
      {
        name: 'bestenliste',
        description: 'Zeigt die Bestenliste an'
      },
      {
        name: 'delulu',
        description: 'Zeigt die deluluste Peroson an'
      },

    ];


const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Registriere Slash Commands');

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    console.log('Slash commands erfolgreich registriert');
  } catch (error) {
    console.error(`Fehler: ${error.message}`);
  }
})();
