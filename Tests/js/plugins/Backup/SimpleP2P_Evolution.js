/*:
 * @target MZ
 * @plugindesc [Evolution] Smooth Movement, Party Sync, & Combat Joining.
 * @author Gemini AI
 *
 * @param Sync Interval
 * @desc Frames between updates. (10 = Good balance of smooth vs lag).
 * @type number
 * @default 10
 *
 * @help
 * ============================================================================
 * SIMPLE P2P: EVOLUTION
 * ============================================================================
 * 1. Create an event on the map named "RemotePlayer".
 * 2. Set its Trigger to "Action Button".
 * 3. Use script calls to Host/Join.
 *
 * HOST: SimpleP2P.host();
 * JOIN: SimpleP2P.join("ROOM_CODE");
 *
 * ============================================================================
 */

(() => {
    const params = PluginManager.parameters('SimpleP2P_Evolution');
    const SYNC_RATE = Number(params['Sync Interval']) || 10;

    window.SimpleP2P = {
        peer: null,
        conn: null,
        myId: "",
        isConnected: false,
        // Store data from the other player here
        remoteData: {
            x: 0, y: 0, mapId: 0, 
            charName: "", charIndex: 0, 
            isFighting: false, 
            actors: [] // Their party members
        },
        
        // --- 1. SETUP ---
        init: function(callback) {
            if (this.peer) {
                if (callback) callback(this.myId);
                return;
            }
            // Basic connection - No fancy config to avoid crashes
            this.peer = new Peer(); 

            this.peer.on('open', (id) => {
                this.myId = id;
                console.log("My ID: " + id);
                if (callback) callback(id);
            });

            this.peer.on('connection', (c) => {
                this.setupConnection(c);
                $gameMessage.add("Another player has joined!");
            });
        },

        host: function() {
            this.init((id) => {
                if (navigator.clipboard) navigator.clipboard.writeText(id);
                $gameMessage.add("Hosting! ID Copied.");
                $gameMessage.add(id);
            });
        },

        join: function(code) {
            const target = String(code).trim(); // Safety trim
            this.init(() => {
                const conn = this.peer.connect(target);
                this.setupConnection(conn);
                $gameMessage.add("Connecting...");
            });
        },

        setupConnection: function(conn) {
            this.conn = conn;
            this.conn.on('open', () => {
                this.isConnected = true;
                console.log("Connected!");
                // Force an immediate update so they see us
                this.sendUpdate();
            });
            
            // Handle incoming data
            this.conn.on('data', (data) => this.handleData(data));
            
            this.conn.on('close', () => {
                this.isConnected = false;
                $gameMessage.add("Connection Lost.");
            });
        },

        // --- 2. THE HEARTBEAT (Send Data) ---
        update: function() {
            if (!this.isConnected || !this.conn) return;

            // Update remote character visuals every frame
            this.updateGhostVisuals();

            // Send OUR data every X frames (Heartbeat)
            // We do this even if not moving, so they know we are still here
            if (Graphics.frameCount % SYNC_RATE === 0) {
                this.sendUpdate();
            }
        },

        sendUpdate: function() {
            const leader = $gameParty.leader();
            const packet = {
                type: 'state',
                mapId: $gameMap.mapId(),
                x: $gamePlayer.x,
                y: $gamePlayer.y,
                // Send our Leader's graphics
                charName: leader ? leader.characterName() : "",
                charIndex: leader ? leader.characterIndex() : 0,
                // Are we fighting?
                isFighting: $gameParty.inBattle(),
                // Send our top 2 actors for party merging
                actors: $gameParty.members().map(a => a.actorId()) 
            };
            this.conn.send(packet);
        },

        // --- 3. RECEIVE DATA ---
        handleData: function(data) {
            if (data.type === 'state') {
                this.remoteData = data;
            }
            // Battle Requests
            if (data.type === 'request_join') {
                if ($gameParty.inBattle()) {
                    this.conn.send({ 
                        type: 'accept_join', 
                        troopId: $gameTroop._troopId 
                    });
                }
            }
            if (data.type === 'accept_join') {
                this.joinBattle(data.troopId);
            }
        },

        // --- 4. GHOST PLAYER LOGIC (The Visuals) ---
        getGhostEvent: function() {
            // Find event named "RemotePlayer"
            return $gameMap.events().find(e => e.event().name === "RemotePlayer");
        },

        updateGhostVisuals: function() {
            const event = this.getGhostEvent();
            if (!event) return; // If user didn't place the event, do nothing

            const data = this.remoteData;

            // 1. Check Map ID
            if (data.mapId !== $gameMap.mapId()) {
                event.setOpacity(0); // Hide if on different map
                return;
            }
            event.setOpacity(255);

            // 2. Update Graphic (Dynamic Sprite)
            // Only update if it changed to avoid flickering
            if (event._characterName !== data.charName || event._characterIndex !== data.charIndex) {
                event.setImage(data.charName, data.charIndex);
            }

            // 3. Combat Indicator
            if (data.isFighting) {
                // If they are fighting, stop moving and show balloon
                if (!event.isBalloonPlaying()) event.requestBalloon(10); // Sword/Sweat
                return; 
            }

            // 4. Smooth Movement (No Teleporting)
            // Calculate distance to target
            const dx = Math.abs(event.x - data.x);
            const dy = Math.abs(event.y - data.y);
            const dist = dx + dy;

            if (dist > 5) {
                // If too far (e.g. they transferred map), teleport immediately
                event.setPosition(data.x, data.y);
            } else if (dist > 0 && !event.isMoving()) {
                // If close, walk towards them one step at a time
                event.moveTowardCharacter({ x: data.x, y: data.y });
            }
        },

        // --- 5. INTERACTION (Clicking the Ghost) ---
        onGhostInteract: function() {
            if (this.remoteData.isFighting) {
                $gameMessage.add("Player is in combat!");
                $gameMessage.setChoices(["Join Fight", "Wait"], 0, 1);
                $gameMessage.setChoiceCallback(n => {
                    if (n === 0) {
                        // Send request to P1
                        this.conn.send({ type: 'request_join' });
                    }
                });
            } else {
                // Standard interaction if not fighting
                $gameMessage.add("It's your coop partner.");
            }
        },

        // --- 6. PARTY MERGING LOGIC ---
        joinBattle: function(troopId) {
            // Logic: P1(1,2) + P2(1,2)
            // We have our party, we have their party IDs in remoteData.actors
            
            const myActors = $gameParty.members().map(a => a.actorId());
            const theirActors = this.remoteData.actors || [];

            // Simple 2-Player Split (Take 2 from them, 2 from me)
            // If you add more players later, you change this math.
            const newParty = [];
            
            // Add Their first 2
            if (theirActors[0]) newParty.push(theirActors[0]);
            if (theirActors[1]) newParty.push(theirActors[1]);
            
            // Add My first 2
            if (myActors[0]) newParty.push(myActors[0]);
            if (myActors[1]) newParty.push(myActors[1]);

            // Apply Party
            $gameParty._actors = newParty;
            $gamePlayer.refresh();

            // Start Fight
            BattleManager.setup(troopId, true, true);
            BattleManager.setEventCallback(n => this._branch = n);
            $gamePlayer.makeEncounterCount();
            SceneManager.push(Scene_Battle);
        }
    };

    // --- OVERRIDES ---

    // 1. Hook into Game Loop
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        SimpleP2P.update();
    };

    // 2. Hook into Event Interaction
    // This allows clicking the "RemotePlayer" event to trigger our custom logic
    const _Game_Event_start = Game_Event.prototype.start;
    Game_Event.prototype.start = function() {
        if (this.event().name === "RemotePlayer") {
            SimpleP2P.onGhostInteract();
            return; // Don't run standard event code
        }
        _Game_Event_start.call(this);
    };

    // 3. Helper for Smooth Movement
    // Adds a simple "Move toward coordinate" helper to Game_Character
    Game_Character.prototype.moveTowardCharacter = function(target) {
        const sx = this.deltaXFrom(target.x);
        const sy = this.deltaYFrom(target.y);
        if (Math.abs(sx) > Math.abs(sy)) {
            this.moveStraight(sx > 0 ? 4 : 6);
        } else if (sy !== 0) {
            this.moveStraight(sy > 0 ? 8 : 2);
        }
    };

})();