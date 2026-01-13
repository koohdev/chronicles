/*:
 * @target MZ
 * @plugindesc [Fixed] Advanced P2P Multiplayer (Crash Fixes).
 * @author Gemini AI
 *
 * @param Sync Interval
 * @desc Frames between sending updates. Lower = smoother, Higher = less lag.
 * @type number
 * @default 3
 *
 * @help
 * ============================================================================
 * ADVANCED P2P MULTIPLAYER (Fixed)
 * ============================================================================
 * FIXES IN THIS VERSION:
 * - Fixed "split of undefined" crash when joining.
 * - Added connection queue to ensure you are ready before joining.
 * * --- HOW TO USE ---
 * 1. HOST: Call Script: SimpleP2P.host();
 * 2. JOIN: Call Script: SimpleP2P.join("ROOM_CODE_HERE");
 * (Make sure you use QUOTES "" around the room code!)
 *
 * ============================================================================
 */

(() => {
    const params = PluginManager.parameters('SimpleP2P_Refined');
    const SYNC_RATE = Number(params['Sync Interval']) || 3;

    window.SimpleP2P = {
        peer: null,
        conn: null,
        myId: "",
        isConnected: false,
        isConnecting: false, // New flag to prevent double joining
        remoteData: {
            x: 0, y: 0, mapId: 0, 
            charName: "", charIndex: 0, 
            isFighting: false, 
            actors: [] 
        },
        
        // --- 1. INITIALIZE ---
        init: function(callback) {
            // If already ready, just run callback
            if (this.peer && !this.peer.disconnected && !this.peer.destroyed) {
                if (callback) callback(this.myId);
                return;
            }

            // Create Peer
            this.peer = new Peer(null, { debug: 1 });

            this.peer.on('open', (id) => {
                this.myId = id;
                console.log('My ID: ' + id);
                if (callback) callback(id);
            });

            this.peer.on('connection', (c) => {
                this.setupConnection(c);
                $gameMessage.add("Player 2 connected!");
            });

            this.peer.on('error', (err) => {
                console.error("PeerJS Error:", err);
                $gameMessage.add("Connection Error: " + err.type);
            });
        },

        // --- 2. HOST ---
        host: function() {
            this.init(() => {
                if (navigator.clipboard) navigator.clipboard.writeText(this.myId);
                $gameMessage.add("Hosting! Code copied.");
                $gameMessage.add(this.myId);
            });
        },

        // --- 3. JOIN (FIXED) ---
        join: function(remoteId) {
            if (this.isConnected || this.isConnecting) return;
            this.isConnecting = true;

            // FIX: Force ID to string to prevent "split" error
            const targetId = String(remoteId).trim();

            $gameMessage.add("Initializing network...");

            // Initialize MY peer first
            this.init((myId) => {
                $gameMessage.add("Dialing " + targetId + "...");
                
                // Connect
                const conn = this.peer.connect(targetId, {
                    reliable: true
                });

                if (!conn) {
                    $gameMessage.add("Error: Could not create connection.");
                    this.isConnecting = false;
                    return;
                }

                this.setupConnection(conn);
            });
        },

        setupConnection: function(conn) {
            this.conn = conn;
            
            this.conn.on('open', () => {
                this.isConnected = true;
                this.isConnecting = false;
                console.log("Connection Open");
                $gameMessage.add("Connected successfully!");
            });

            this.conn.on('data', (data) => this.handleData(data));
            
            this.conn.on('close', () => {
                this.isConnected = false;
                $gameMessage.add("Connection lost.");
                this.removeRemoteEvent();
            });

            this.conn.on('error', (err) => {
                console.error("Conn Error:", err);
                this.isConnecting = false;
            });
        },

        // --- 4. SEND DATA ---
        update: function() {
            if (!this.isConnected || !this.conn) return;

            // Only send if connection is actually open
            if (!this.conn.open) return;

            if (Graphics.frameCount % SYNC_RATE === 0) {
                const myActors = $gameParty.members().slice(0, 2).map(a => a.actorId());
                const packet = {
                    type: 'move',
                    mapId: $gameMap.mapId(),
                    x: $gamePlayer.x,
                    y: $gamePlayer.y,
                    charName: $gameParty.leader() ? $gameParty.leader().characterName() : "",
                    charIndex: $gameParty.leader() ? $gameParty.leader().characterIndex() : 0,
                    isFighting: $gameParty.inBattle(),
                    actors: myActors 
                };
                this.conn.send(packet);
            }
        },

        // --- 5. RECEIVE DATA ---
        handleData: function(data) {
            if (data.type === 'move') {
                this.remoteData = data;
                this.updateRemoteEventVisuals();
            }
            
            if (data.type === 'request_join_battle') {
                if ($gameParty.inBattle()) {
                    this.conn.send({
                        type: 'approve_join_battle',
                        troopId: $gameTroop._troopId
                    });
                }
            }

            if (data.type === 'approve_join_battle') {
                this.startMixedBattle(data.troopId);
            }
        },

        // --- 6. VISUALS ---
        updateRemoteEventVisuals: function() {
            const mapId = $gameMap.mapId();
            
            if (this.remoteData.mapId !== mapId) {
                this.removeRemoteEvent();
                return;
            }

            let event = this.getRemoteEvent();
            if (!event) {
                this.spawnRemoteEvent(this.remoteData.x, this.remoteData.y);
                event = this.getRemoteEvent();
            }

            if (event) {
                event.setOpacity(255);
                event.setImage(this.remoteData.charName, this.remoteData.charIndex);
                event.setTargetPos(this.remoteData.x, this.remoteData.y);

                if (this.remoteData.isFighting) {
                    if (!event.isBalloonPlaying()) event.requestBalloon(10); 
                }
            }
        },

        removeRemoteEvent: function() {
            const event = this.getRemoteEvent();
            if (event) event.setOpacity(0);
        },

        getRemoteEvent: function() {
            return $gameMap.event(999);
        },

        spawnRemoteEvent: function(x, y) {
            // Check if already exists to avoid dupes
            if ($gameMap._events[999]) return;

            $gameMap._events[999] = new Game_RemoteEvent($gameMap.mapId(), 999);
            $gameMap._events[999].setPosition(x, y);
            
            if (SceneManager._scene instanceof Scene_Map) {
                // Safely add sprite to Scene
                const spriteset = SceneManager._scene._spriteset;
                const newSprite = new Sprite_Character($gameMap._events[999]);
                spriteset._characterSprites.push(newSprite);
                spriteset._tilemap.addChild(newSprite);
            }
        },

        // --- 7. BATTLE SYNC ---
        requestJoinBattle: function() {
            if (this.conn) {
                this.conn.send({ type: 'request_join_battle' });
            }
        },

        startMixedBattle: function(troopId) {
            const p1Actors = this.remoteData.actors || [];
            const p2Actors = $gameParty.members().slice(0, 2).map(a => a.actorId());
            const newPartyIds = [...p1Actors, ...p2Actors];
            
            // Backup not implemented, permanent party change for session
            $gameParty._actors = newPartyIds;
            $gamePlayer.refresh();

            BattleManager.setup(troopId, true, true);
            BattleManager.setEventCallback(n => {
                this._branch[this._indent] = n;
            });
            $gamePlayer.makeEncounterCount();
            SceneManager.push(Scene_Battle);
        }
    };

    // --- 8. HOOKS ---
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        SimpleP2P.update();
    };

    // --- Custom Event Class ---
    class Game_RemoteEvent extends Game_Event {
        initialize(mapId, eventId) {
            super.initialize(mapId, eventId);
            this._targetX = 0;
            this._targetY = 0;
            this.setThrough(true); 
        }

        event() {
            return {
                id: 999, name: "RemotePlayer", x: 0, y: 0, pages: [{
                    conditions: {}, list: [{code:0}], image: {}, priorityType: 1, trigger: 0
                }]
            };
        }

        setTargetPos(x, y) {
            this._targetX = x;
            this._targetY = y;
        }

        update() {
            super.update();
            this.updateSmoothMovement();
        }

        updateSmoothMovement() {
            if (SimpleP2P.remoteData.isFighting) return;

            const dist = Math.abs(this.x - this._targetX) + Math.abs(this.y - this._targetY);
            if (dist > 5) {
                this.setPosition(this._targetX, this._targetY);
                return;
            }

            if (!this.isMoving()) {
                if (this.x < this._targetX) this.moveStraight(6);
                else if (this.x > this._targetX) this.moveStraight(4);
                else if (this.y < this._targetY) this.moveStraight(2);
                else if (this.y > this._targetY) this.moveStraight(8);
            }
        }

        start() {
            if (SimpleP2P.remoteData.isFighting) {
                $gameMessage.add("Player is in combat!");
                $gameMessage.setChoices(["Join Fight", "Watch"], 0, 1);
                $gameMessage.setChoiceCallback(n => {
                    if (n === 0) SimpleP2P.requestJoinBattle();
                });
            } else {
                // Optional: Interaction when not fighting
                // $gameMessage.add("Hello!");
            }
        }
    }

    window.Game_RemoteEvent = Game_RemoteEvent;
})();