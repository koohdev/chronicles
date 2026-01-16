/*:
 * @target MZ
 * @plugindesc [Evolution V2] Multiplayer: Smart Move, Battle Indicators, & Party Merge.
 * @author Gemini AI
 *
 * @param Sync Interval
 * @desc Frames between network updates. Lower = smoother but more internet usage.
 * @type number
 * @default 6
 *
 * @param Combat Icon ID
 * @desc The Icon ID to show above a player's head when they are fighting (Default 76 is a sword).
 * @type number
 * @default 76
 *
 * @help
 * ============================================================================
 * SIMPLE P2P: EVOLUTION V2
 * ============================================================================
 * 1. Create an event on the map named "RemotePlayer".
 * 2. Set Trigger: "Action Button". Priority: "Same as Characters".
 * 3. Use script calls to Host/Join.
 *
 * HOST: SimpleP2P.host();
 * JOIN: SimpleP2P.join("ROOM_CODE");
 *
 * --- NEW FEATURES ---
 * - Combat Icon: Shows automatically when other player is fighting.
 * - Join Battle: Click the player to join their active fight.
 * - Party Merge: Becomes Host(1,2) + Client(1,2).
 * ============================================================================
 */

(() => {
    const params = PluginManager.parameters('SimpleP2P_Evolution');
    const SYNC_RATE = Number(params['Sync Interval']) || 6;
    const COMBAT_ICON = Number(params['Combat Icon ID']) || 76;

    window.SimpleP2P = {
        peer: null,
        conn: null,
        myId: "",
        isConnected: false,
        // The data we receive from the other player
        remoteData: {
            x: 0, y: 0, mapId: 0, 
            charName: "", charIndex: 0, 
            isFighting: false, 
            actors: [] 
        },
        
        // --- 1. CONNECTION SETUP ---
        init: function(callback) {
            if (this.peer) {
                if (callback) callback(this.myId);
                return;
            }
            this.peer = new Peer(); // Standard PeerJS connection

            this.peer.on('open', (id) => {
                this.myId = id;
                console.log("My ID: " + id);
                if (callback) callback(id);
            });

            this.peer.on('connection', (c) => {
                this.setupConnection(c);
                $gameMessage.add("Player 2 has connected!");
            });
        },

        host: function() {
            this.init((id) => {
                // Copy ID to clipboard for easy sharing
                const input = document.createElement('input');
                input.value = id;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
                
                $gameMessage.add("Hosting! Room Code copied to clipboard.");
                $gameMessage.add(id);
            });
        },

        join: function(code) {
            const target = String(code).trim();
            this.init(() => {
                const conn = this.peer.connect(target);
                this.setupConnection(conn);
                $gameMessage.add("Attempting to connect...");
            });
        },

        setupConnection: function(conn) {
            this.conn = conn;
            this.conn.on('open', () => {
                this.isConnected = true;
                this.sendUpdate(); // Say hello immediately
            });
            
            this.conn.on('data', (data) => this.handleData(data));
            
            this.conn.on('close', () => {
                this.isConnected = false;
                $gameMessage.add("Connection Lost.");
            });
        },

        // --- 2. SENDING DATA (Heartbeat) ---
        update: function() {
            if (!this.isConnected || !this.conn) return;

            // Send my status
            if (Graphics.frameCount % SYNC_RATE === 0) {
                this.sendUpdate();
            }
            
            // Move the ghost event to match received data
            this.processGhostMovement();
        },

        sendUpdate: function() {
            const leader = $gameParty.leader();
            const packet = {
                type: 'state',
                mapId: $gameMap.mapId(),
                x: $gamePlayer.x,
                y: $gamePlayer.y,
                // Visuals
                charName: leader ? leader.characterName() : "",
                charIndex: leader ? leader.characterIndex() : 0,
                // Combat Status
                isFighting: $gameParty.inBattle(),
                // Send top 2 actors for party merging
                actors: $gameParty.members().map(a => a.actorId()).slice(0, 2) 
            };
            this.conn.send(packet);
        },

        // --- 3. RECEIVING DATA & BATTLE LOGIC ---
        handleData: function(data) {
            if (data.type === 'state') {
                this.remoteData = data;
            }
            
            // P2 asks to join P1's fight
            if (data.type === 'request_join') {
                if ($gameParty.inBattle()) {
                    // P1 ACKNOLWEDGES
                    // 1. Send P1's current troop and actors to P2
                    this.conn.send({ 
                        type: 'accept_join', 
                        troopId: $gameTroop._troopId,
                        hostActors: $gameParty.members().map(a => a.actorId()).slice(0, 2)
                    });

                    // 2. LIVE PARTY SWAP (The P1 side)
                    // Remove P1's 3rd and 4th members
                    const p1Members = $gameParty.members();
                    if (p1Members.length > 2) {
                        $gameParty.removeActor(p1Members[2].actorId());
                    }
                    if (p1Members.length > 2) { // Check again as array shifted
                        $gameParty.removeActor(p1Members[2].actorId());
                    }
                    
                    // Add P2's 1st and 2nd members (received from their state)
                    const p2Actors = this.remoteData.actors;
                    if (p2Actors[0]) $gameParty.addActor(p2Actors[0]);
                    if (p2Actors[1]) $gameParty.addActor(p2Actors[1]);
                    
                    $gameMessage.add("Player 2 joined the battle!");
                }
            }
            
            // P1 accepted P2's request
            if (data.type === 'accept_join') {
                this.joinBattleAsClient(data.troopId, data.hostActors);
            }
        },

        // --- 4. GHOST VISUALS & MOVEMENT ---
        getGhostEvent: function() {
            return $gameMap.events().find(e => e.event().name === "RemotePlayer");
        },

        processGhostMovement: function() {
            const event = this.getGhostEvent();
            if (!event) return;

            const data = this.remoteData;

            // Hide if on wrong map
            if (data.mapId !== $gameMap.mapId()) {
                event.setOpacity(0);
                return;
            }
            event.setOpacity(255);

            // Update Sprite
            if (event._characterName !== data.charName || event._characterIndex !== data.charIndex) {
                event.setImage(data.charName, data.charIndex);
            }

            // SMART MOVEMENT (Fixes lag)
            const dx = event.x - data.x;
            const dy = event.y - data.y;
            const dist = Math.abs(dx) + Math.abs(dy);

            if (dist > 5) {
                // Teleport if too far (map transition)
                event.setPosition(data.x, data.y);
            } else if (dist > 0) {
                // Speed up if falling behind, slow down if close
                // 4 is normal speed, 5 is fast
                event.setMoveSpeed(dist > 2 ? 5 : 4); 
                event.moveTowardCharacter({x: data.x, y: data.y});
            }
        },

        // --- 5. INTERACTION & BATTLE START ---
        onGhostInteract: function() {
            // Is the other player fighting?
            if (this.remoteData.isFighting) {
                $gameMessage.add("Player is currently in battle!");
                $gameMessage.setChoices(["Join Fight", "Observe"], 0, 1);
                $gameMessage.setChoiceCallback(n => {
                    if (n === 0) {
                        // Send request to Host
                        this.conn.send({ type: 'request_join' });
                        $gameMessage.add("Requesting to join...");
                    }
                });
            } else {
                $gameMessage.add("It's your coop partner.");
            }
        },

        // CLIENT SIDE BATTLE START (P2)
        joinBattleAsClient: function(troopId, hostActors) {
            // Construct the 2+2 Party
            const myActors = $gameParty.members().map(a => a.actorId()).slice(0, 2);
            const newPartyIds = [...hostActors, ...myActors];

            // Force party change
            $gameParty._actors = newPartyIds;
            $gamePlayer.refresh();

            // Launch Battle
            BattleManager.setup(troopId, true, true);
            BattleManager.setEventCallback(n => this._branch = n);
            $gamePlayer.makeEncounterCount();
            SceneManager.push(Scene_Battle);
        }
    };

    // ======================================================================
    //  OVERRIDES & HOOKS
    // ======================================================================

    // 1. Update Loop
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        SimpleP2P.update();
    };

    // 2. Event Interaction Hook
    const _Game_Event_start = Game_Event.prototype.start;
    Game_Event.prototype.start = function() {
        if (this.event().name === "RemotePlayer") {
            SimpleP2P.onGhostInteract();
            return;
        }
        _Game_Event_start.call(this);
    };

    // 3. Movement Helper
    Game_Character.prototype.moveTowardCharacter = function(target) {
        const sx = this.deltaXFrom(target.x);
        const sy = this.deltaYFrom(target.y);
        if (Math.abs(sx) > Math.abs(sy)) this.moveStraight(sx > 0 ? 4 : 6);
        else if (sy !== 0) this.moveStraight(sy > 0 ? 8 : 2);
    };

    // 4. COMBAT INDICATOR (The Icon)
    const _Sprite_Character_update = Sprite_Character.prototype.update;
    Sprite_Character.prototype.update = function() {
        _Sprite_Character_update.call(this);
        this.updateCombatIcon();
    };

    Sprite_Character.prototype.updateCombatIcon = function() {
        // Only valid for the RemotePlayer event
        if (!this._character || !this._character.event) return;
        if (this._character.event().name !== "RemotePlayer") return;

        // Check if fighting
        const isFighting = SimpleP2P.remoteData.isFighting;

        // Create icon sprite if needed
        if (!this._combatIconSprite) {
            this._combatIconSprite = new Sprite();
            this._combatIconSprite.bitmap = ImageManager.loadSystem('IconSet');
            // Standard Icon size is 32x32
            const pw = 32;
            const ph = 32;
            const sx = (COMBAT_ICON % 16) * pw;
            const sy = Math.floor(COMBAT_ICON / 16) * ph;
            this._combatIconSprite.setFrame(sx, sy, pw, ph);
            this._combatIconSprite.anchor.x = 0.5;
            this._combatIconSprite.anchor.y = 1;
            this._combatIconSprite.y = -60; // Float above head
            this.addChild(this._combatIconSprite);
        }

        // Toggle Visibility
        this._combatIconSprite.visible = isFighting;
        
        // Optional: Bobbing animation
        if (isFighting) {
            this._combatIconSprite.y = -60 + Math.sin(Date.now() / 200) * 5;
        }
    };

})();