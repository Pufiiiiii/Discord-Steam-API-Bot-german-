require('dotenv').config();
const { Client, IntentsBitField } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.GuildMessageReactions,
  ],
});

client.once('ready', (c) => {
  console.log(`✅ ${c.user.tag} is online.`);
});

let userSteamIDs = {};
const STEAM_API_KEY = process.env.STEAM;

if (fs.existsSync('steamIDs.json')) {
  try {
    const data = fs.readFileSync('steamIDs.json', 'utf8');
    userSteamIDs = JSON.parse(data);
  } catch (err) {
    console.error('Error reading or parsing steamIDs.json:', err);
    userSteamIDs = {};
  }
}

const resolveVanityURL = async (vanityUrl) => {
  try {
    const response = await axios.get(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${vanityUrl}`);
    if (response.data.response.success === 1) {
      return response.data.response.steamid;
    } else {
      throw new Error('Vanity URL Fehler');
    }
  } catch (error) {
    console.error(error);
    return null;
  }
};

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'hilfe') {
    interaction.reply("\n/gamestats \n\n Zeigt die aktuelle Spielstatistik von einem Spiel \n \n \n /spielzeit \n \nZeigt die Playtime von einem User in einem bestimmten game an!");
  }

  if (interaction.commandName === 'anmelden_für_steam') {
    const steamUsername = interaction.options.getString('steamid');
    try {
      const response = await axios.get(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${steamUsername}`);
      const steamID = response.data.response.steamid;
      if (steamID) {
        userSteamIDs[interaction.user.id] = steamID;
        fs.writeFileSync('steamIDs.json', JSON.stringify(userSteamIDs, null, 2));
        interaction.reply(`Deine Steam User ID wurde gespeichert: ${steamID}`);
      } else {
        interaction.reply('Steam User ID konnte nicht gefunden werden.');
      }
    } catch (error) {
      console.error(error);
      interaction.reply('Es gab einen Fehler beim Abrufen der Steam User ID.');
    }
  }

  if (interaction.commandName === 'bestenliste') {
    try {
      const results = await Promise.all(Object.keys(userSteamIDs).map(async (userId) => {
        const steamId = userSteamIDs[userId];
        const gamesResponse = await axios.get(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true`);
        const games = gamesResponse.data.response.games;
        if (!games) {
          return { userId, totalPlaytimeHours: 'Keine Spiele gefunden oder ungültige Steam-ID.' };
        }
        const totalPlaytimeMinutes = games.reduce((acc, game) => acc + game.playtime_forever, 0);
        const totalPlaytimeHours = (totalPlaytimeMinutes / 60).toFixed(2);
        return { userId, totalPlaytimeHours };
      }));
      const playtimeSummary = await Promise.all(results.map(async (result) => {
        let user = client.users.cache.get(result.userId);
        if (!user) {
          user = await client.users.fetch(result.userId);
        }
        const username = user ? user.username : 'Unbekannt';
        return `${username}: ${result.totalPlaytimeHours} Stunden`;
      }));
      interaction.reply(`Gesamte Spielzeiten aller Benutzer:\n${playtimeSummary.join('\n')}`);
    } catch (error) {
      console.error(error);
      interaction.reply('Es gab einen Fehler beim Abrufen der Daten. Bitte versuchen Sie es später erneut.');
    }
  }

  if (interaction.commandName === 'gamestats') {
    const gameName = interaction.options.getString('game');
    try {
      const storeResponse = await axios.get(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=us`);
      const gameData = storeResponse.data.items[0];
      if (!gameData) {
        return interaction.reply('Kein Spiel mit diesem Namen gefunden. Bitte überprüfen Sie den Namen und versuchen Sie es erneut.');
      }
      const gameId = gameData.id;
      const spielerzahlen = await axios.get(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${gameId}`);
      const { player_count } = spielerzahlen.data.response;
      if (player_count === undefined) {
        return interaction.reply('Ungültige AppID oder keine Daten verfügbar.');
      }
      const detailsResponse = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${gameId}`);
      const gameDetails = detailsResponse.data[gameId].data;
      const { name, price_overview, release_date, metacritic } = gameDetails;
      const price = price_overview ? `${price_overview.final / 100} ${price_overview.currency}` : 'Kostenlos';
      const releaseDate = release_date ? release_date.date : 'Unbekannt';
      const metacriticScore = metacritic ? metacritic.score : 'Keine Bewertungen verfügbar';
      interaction.reply(`
        **${name}**
        - Aktuelle Spielerzahl: ${player_count}
        - Preis: ${price}
        - Veröffentlichungsdatum: ${releaseDate}
        - Metacritic Bewertung: ${metacriticScore}
      `);
    } catch (error) {
      console.error(error);
      interaction.reply('Es gab einen Fehler beim Abrufen der Daten. Bitte versuchen Sie es später erneut.');
    }
  }

  if (interaction.commandName === 'spielzeit') {
    const steamIdOrVanityUrl = interaction.options.getString('steamid');
    const gameNameForPlaytime = interaction.options.getString('game');
    try {
      let steamId = steamIdOrVanityUrl;
      if (isNaN(steamId)) {
        steamId = await resolveVanityURL(steamIdOrVanityUrl);
        if (!steamId) {
          return interaction.reply('Ungültige Vanity-URL. Bitte überprüfen Sie den Namen und versuchen Sie es erneut.');
        }
      }
      const gamesResponse = await axios.get(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true`);
      const games = gamesResponse.data.response.games;
      if (!games) {
        return interaction.reply('Keine Spiele gefunden oder ungültige Steam-ID.');
      }
      const game = games.find(g => g.name.toLowerCase() === gameNameForPlaytime.toLowerCase());
      if (!game) {
        return interaction.reply('Spiel nicht gefunden. Bitte überprüfen Sie den Namen und versuchen Sie es erneut.');
      }
      const playtimeHours = (game.playtime_forever / 60).toFixed(2);
      interaction.reply(`${interaction.user.username} hat in ${game.name}: ${playtimeHours} Stunden`);
    } catch (error) {
      console.error(error);
      interaction.reply('Es gab einen Fehler beim Abrufen der Daten. Bitte versuchen Sie es später erneut.');
    }
  }

  if (interaction.commandName === 'gesamte_spielzeit') {
    const steamIdOrVanityUrl = interaction.options.getString('steamid');
    try {
      let steamId = steamIdOrVanityUrl;
      if (isNaN(steamId)) {
        steamId = await resolveVanityURL(steamIdOrVanityUrl);
        if (!steamId) {
          return interaction.reply('Ungültige Vanity-URL. Bitte überprüfen Sie den Namen und versuchen Sie es erneut.');
        }
      }
      const gamesResponse = await axios.get(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true`);
      const games = gamesResponse.data.response.games;
      if (!games) {
        return interaction.reply('Keine Spiele gefunden oder ungültige Steam-ID.');
      }
      const totalPlaytimeMinutes = games.reduce((acc, game) => acc + game.playtime_forever, 0);
      const totalPlaytimeHours = (totalPlaytimeMinutes / 60).toFixed(2);
      interaction.reply(`${steamIdOrVanityUrl}s gesamte Steam Spielzeit: ${totalPlaytimeHours} Stunden`);
    } catch (error) {
      console.error(error);
      interaction.reply('Es gab einen Fehler beim Abrufen der Daten. Bitte versuchen Sie es später erneut.');
    }
  }

  if (interaction.commandName === 'delulu') {
    interaction.reply("Jacey");
  }
});

client.login(process.env.TOKEN);
