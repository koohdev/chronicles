/*:
 * @target MZ
 * @plugindesc Extremely simple enemy scaling. Safe for existing saves.
 * @author Gemini AI
 *
 * @param Growth Rate
 * @desc Percent increase per level (e.g., 0.03 = 3%).
 * @default 0.03
 *
 * @param Ignored Params
 * @type number[]
 * @desc Stats to exclude from scaling (0:HP, 1:MP, 2:ATK, 3:DEF, 4:MAT, 5:MDF, 6:AGI, 7:LUK).
 * @default []
 *
 * @help
 * This plugin automatically scales all enemies based on the
 * AVERAGE battle party level.
 *
 * Formula: BaseStat * (1 + (GrowthRate * PartyLevel))
 *
 * IMPORTANT NOTE:
 * This plugin DOES NOT affect Element Rates, State Rates, or Debuff Rates.
 * It only scales the 8 base numeric stats.
 *
 * To EXCLUDE a specific enemy (Boss):
 * Put <NoScale> in the enemy's Note box in the Database.
 *
 * To EXCLUDE specific stats (like Defense):
 * Add the ID to "Ignored Params" in Plugin Manager.
 * (e.g., add 3 and 5 to keep DEF and MDF static).
 */

(() => {
    const params = PluginManager.parameters('SimpleEnemyScaling');
    const rate = parseFloat(params['Growth Rate'] || 0.03);
    
    // Parse the ignored parameters array (safely handle if empty)
    let ignoredList = [];
    try {
        ignoredList = JSON.parse(params['Ignored Params'] || '[]').map(Number);
    } catch (e) {
        ignoredList = [];
    }

    const _Game_Enemy_paramBase = Game_Enemy.prototype.paramBase;
    Game_Enemy.prototype.paramBase = function(paramId) {
        const base = _Game_Enemy_paramBase.call(this, paramId);
        
        // Check for <NoScale> tag to skip bosses
        if (this.enemy().meta.NoScale) return base;

        // Check if this specific parameter should be ignored (e.g. DEF)
        if (ignoredList.includes(paramId)) return base;

        // Calculate Average Party Level
        const party = $gameParty.battleMembers();
        let lvlSum = 0;
        for (const actor of party) {
            lvlSum += actor.level;
        }
        const avgLvl = Math.max(1, Math.floor(lvlSum / party.length));

        // Apply Scaling: Base * (1 + (0.03 * Level))
        return Math.floor(base * (1 + (rate * (avgLvl - 1))));
    };
    
    // Scale EXP and Gold too
    const _Game_Enemy_exp = Game_Enemy.prototype.exp;
    Game_Enemy.prototype.exp = function() {
        const base = _Game_Enemy_exp.call(this);
        if (this.enemy().meta.NoScale) return base;
        
        const party = $gameParty.battleMembers();
        let lvlSum = 0;
        for (const actor of party) lvlSum += actor.level;
        const avgLvl = Math.max(1, Math.floor(lvlSum / party.length));
        
        return Math.floor(base * (1 + (rate * (avgLvl - 1))));
    };

    const _Game_Enemy_gold = Game_Enemy.prototype.gold;
    Game_Enemy.prototype.gold = function() {
        const base = _Game_Enemy_gold.call(this);
        if (this.enemy().meta.NoScale) return base;
        
        const party = $gameParty.battleMembers();
        let lvlSum = 0;
        for (const actor of party) lvlSum += actor.level;
        const avgLvl = Math.max(1, Math.floor(lvlSum / party.length));
        
        return Math.floor(base * (1 + (rate * (avgLvl - 1))));
    };

})();