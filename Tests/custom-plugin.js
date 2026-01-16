


(() => {



    let params = PluginManager.parameters('ProceduralQuestSystem');

    if (!params || Object.keys(params).length === 0) {

        console.warn("Quest System: Could not find parameters. Using Defaults (1, 2, 23).");

        params = {};

    }


    const VAR_STATUS = Number(params['Quest Variable ID']) || 1;

    const VAR_PROGRESS = Number(params['Progress Variable ID']) || 2;

    const VAR_TEXT = Number(params['Quest Text Variable']) || 23;




    function checkSystemData() {

        if (!$gameSystem) return;

        if (!$gameSystem._pQuest) {

            $gameSystem._pQuest = {

                active: false,

                type: "", targetId: 0, targetName: "",

                amountNeeded: 0, amountCurrent: 0,

                rewardGold: 0, rewardExp: 0,

                desc: "", knownZones: {} 

            };

        }

    }




    const _Game_System_initialize = Game_System.prototype.initialize;

    Game_System.prototype.initialize = function() {

        _Game_System_initialize.call(this);

        this._pQuest = {

            active: false,

            type: "", targetId: 0, targetName: "",

            amountNeeded: 0, amountCurrent: 0,

            rewardGold: 0, rewardExp: 0,

            desc: "", knownZones: {} 

        };

    };


    window.QuestSystem = {



        registerCurrentMap: function(storyLevel) {

            checkSystemData();

            const sys = $gameSystem._pQuest;

            const mapName = $dataMap.displayName || "Wilderness";




            let localEnemies = [];

            $gameMap.encounterList().forEach(enc => {

                const troop = $dataTroops[enc.troopId];

                if (troop) {

                    troop.members.forEach(m => {

                        if (!localEnemies.includes(m.enemyId)) localEnemies.push(m.enemyId);

                    });

                }

            });




            let localItems = [];

            localEnemies.forEach(eId => {

                const enemy = $dataEnemies[eId];

                if (enemy && enemy.dropItems) {

                    enemy.dropItems.forEach(d => {

                        if (d.kind === 1) localItems.push(d.dataId);

                    });

                }

            });


            if (localEnemies.length > 0) {

                sys.knownZones[storyLevel] = { name: mapName, enemies: localEnemies, items: localItems };

                console.log(Quest System: Registered ${mapName} (Level ${storyLevel}));

            } else {

                console.log("Quest System: No enemies found to register on this map.");

            }

        },




        generateFromProgress: function() {

            $gameVariables.setValue(VAR_TEXT, "Looking for work..."); 


            try {

                checkSystemData();

                const progress = $gameVariables.value(VAR_PROGRESS) || 1;

                const sys = $gameSystem._pQuest;




                let validLevels = [];

                for (let lvl in sys.knownZones) {

                    if (Number(lvl) <= progress) validLevels.push(lvl);

                }


                if (validLevels.length === 0) {

                    const errorMsg = "I don't have any maps in my logs yet.";

                    $gameVariables.setValue(VAR_TEXT, errorMsg);

                    return;

                }




                const zoneLevel = validLevels[Math.floor(Math.random() * validLevels.length)];

                const zone = sys.knownZones[zoneLevel];




                let type = "HUNT";

                if (zone.items && zone.items.length > 0 && Math.random() > 0.5) type = "GATHER";




                this.createQuest(type, zone, Number(zoneLevel));


            } catch (e) {

                console.error(e);

                $gameVariables.setValue(VAR_TEXT, "Quest Error! Check Console (F8).");

            }

        },




        createQuest: function(type, zone, mapLevel) {

            const q = $gameSystem._pQuest;

            q.type = type;

            



            const mapBonus = mapLevel * 50; 


            if (type === "HUNT") {

                q.targetId = zone.enemies[Math.floor(Math.random() * zone.enemies.length)];

                const db = $dataEnemies[q.targetId];

                q.targetName = db.name;

                q.amountNeeded = Math.floor(Math.random() * 3) + 2;

                



                q.rewardGold = (db.gold * q.amountNeeded * 2) + mapBonus;

                q.rewardExp = db.exp * q.amountNeeded * 1.5;

                



                q.desc = Hunt ${q.amountNeeded} ${q.targetName}s in ${zone.name}.;

            } else {

                q.targetId = zone.items[Math.floor(Math.random() * zone.items.length)];

                const db = $dataItems[q.targetId];

                q.targetName = db.name;

                q.amountNeeded = Math.floor(Math.random() * 2) + 1;

                



                let basePrice = db.price > 0 ? db.price : 10; 

                q.rewardGold = (basePrice * q.amountNeeded * 4) + mapBonus;

                q.rewardExp = q.rewardGold / 2;




                q.desc = Gather ${q.amountNeeded} ${q.targetName}s from ${zone.name}.;

            }


            q.active = true;

            q.amountCurrent = 0;

            $gameVariables.setValue(VAR_STATUS, 1);

            



            const fullText = q.desc + \n\n(Reward: ${Math.floor(q.rewardGold)}G);

            $gameVariables.setValue(VAR_TEXT, fullText);

        },




        checkCompletion: function() {

            checkSystemData();

            const q = $gameSystem._pQuest;

            if (!q.active) {

                $gameMessage.add("No active quest.");

                return;

            }


            let done = false;

            if (q.type === "HUNT") {

                if (q.amountCurrent >= q.amountNeeded) done = true;

                else $gameMessage.add(Defeated: ${q.amountCurrent}/${q.amountNeeded});

            } else {

                if ($gameParty.numItems($dataItems[q.targetId]) >= q.amountNeeded) {

                    done = true;

                    $gameParty.loseItem($dataItems[q.targetId], q.amountNeeded);

                } else $gameMessage.add(Collected: ${$gameParty.numItems($dataItems[q.targetId])}/${q.amountNeeded});

            }


            if (done) {

                $gameMessage.add("Quest Complete!");

                $gameParty.gainGold(Math.floor(q.rewardGold));

                $gameParty.members().forEach(a => a.changeExp(a.currentExp() + Math.floor(q.rewardExp), true));

                q.active = false;

                $gameVariables.setValue(VAR_STATUS, 0);

            }

        }

    };




    const _Game_Enemy_performCollapse = Game_Enemy.prototype.performCollapse;

    Game_Enemy.prototype.performCollapse = function() {

        _Game_Enemy_performCollapse.call(this);

        checkSystemData();

        const q = $gameSystem._pQuest;

        if (q && q.active && q.type === "HUNT" && this.enemyId() === q.targetId) {

            q.amountCurrent++;

        }

    };

})();




