/*:
 * @target MZ
 * @plugindesc (MZ) Math Battle System V10 - Clean Integer Answers & Division Cap
 * @author Gemini AI
 *
 * @help
 * ============================================================================
 * Math Battle System V10
 * ============================================================================
 * * INSTRUCTIONS:
 * 1. Paste this code into "MathBattleSystem_MZ.js".
 * 2. Ensure Battle System is set to "Time Progress (Wait)".
 *
 * --- UPDATE V10: DIVISION CAP ---
 * - Multiplication AND Division now cap the second number at 20.
 * - Ensures questions like "80 / 4" (Valid) instead of "80 / 37" (Hard).
 * - Still enforces Clean Integer Rules (Must divide evenly).
 *
 * --- TIMER LOGIC (Content Aware) ---
 * 1. Hard Ops (* /) give 1.25s. Simple Ops (+ -) give 0.5s.
 * 2. Large Numbers (>30) give extra time. Huge Numbers (>100) give more.
 * 3. Total Digits add time.
 */

(() => {
    const pluginName = "MathBattleSystem_MZ";

    // --- LOGIC SYSTEM ---
    const MathSystem = {
        resultMultiplier: 1.0,
        forceCrit: false,
        forceMiss: false,
        isMathPaused: false,
        currentActorLevel: 1,

        generateProblem: function(level) {
            let isValid = false;
            let problemData = {};
            // Increased safety count to ensure we find a clean division result
            let safetyCount = 0;

            while (!isValid && safetyCount < 300) {
                safetyCount++;
                let visualStr = "";
                let formulaStr = "";
                let numTerms = 2;
                let operatorsPool = ['+', '-'];
                let useParens = false;
                let maxVal = 20;

                // --- DIFFICULTY CONFIG ---
                if (level >= 40) { 
                    numTerms = 3; 
                    maxVal = 50; 
                }
                if (level >= 50) {
                    operatorsPool = ['+', '-', '*', '/'];
                    if (Math.random() < 0.5) useParens = true; 
                    maxVal = 100;
                }
                if (level >= 70) {
                    maxVal = 500; 
                }

                // Generate Numbers
                let nums = [];
                for(let i=0; i<numTerms; i++) nums.push(Math.floor(Math.random() * maxVal) + 1);

                // Generate Operators
                let ops = [];
                let hasDivision = false;
                for(let i=0; i<numTerms-1; i++) {
                    let op = operatorsPool[Math.floor(Math.random() * operatorsPool.length)];
                    // Prevent double division to keep things readable
                    if (op === '/') {
                        if (hasDivision) { op = '+'; } else { hasDivision = true; }
                    }
                    ops.push(op);
                }

                // --- CONSTRAINT: Multiplication & Division Scaling ---
                // If operation is * or /, force the second number to be small (1-20)
                // This prevents overwhelming calculations like 74 * 44 or 74 / 44
                for (let i = 0; i < ops.length; i++) {
                    if (ops[i] === '*' || ops[i] === '/') {
                        nums[i+1] = Math.floor(Math.random() * 20) + 1;
                    }
                }

                // Construct Visual String
                if (level >= 50 && useParens && numTerms === 3) {
                    if (Math.random() < 0.5) {
                        visualStr = `(${nums[0]} ${ops[0]} ${nums[1]}) ${ops[1]} ${nums[2]}`;
                    } else {
                        visualStr = `${nums[0]} ${ops[0]} (${nums[1]} ${ops[1]} ${nums[2]})`;
                    }
                } else {
                    visualStr = `${nums[0]}`;
                    for (let i=0; i<ops.length; i++) visualStr += ` ${ops[i]} ${nums[i+1]}`;
                }

                // Evaluate Answer
                formulaStr = visualStr; 
                let rawAnswer = 0;
                try { rawAnswer = eval(formulaStr); } catch (e) { continue; }
                
                // --- VALIDATION CHECKS ---
                
                // 1. Must be finite number
                if (!isFinite(rawAnswer) || isNaN(rawAnswer)) continue;

                // 2. MUST BE WHOLE NUMBER (No Decimals)
                // logic: checks if dividing by 1 leaves a remainder
                if (!Number.isInteger(rawAnswer)) continue;

                let answer = rawAnswer;
                
                // 3. No negative answers below level 50
                if (level < 50 && answer < 0) continue;

                // --- SMART TIMER CALCULATION ---
                let frames = 180; // Base: 3 Seconds
                
                // Op Weights
                for (let op of ops) {
                    if (op === '*' || op === '/') {
                        frames += 75; // +1.25s
                    } else {
                        frames += 30; // +0.5s
                    }
                }
                
                // Magnitude Weights
                for (let n of nums) {
                    if (n > 30) frames += 30; 
                    if (n > 100) frames += 30;
                }

                // Complexity Weights
                if (visualStr.includes('(')) frames += 45; 
                if (visualStr.includes('/')) frames += 45; 

                // Level Scaling
                frames += (level * 2);

                // Digit Scaling
                let totalDigits = nums.reduce((sum, n) => sum + String(n).length, 0);
                frames += (totalDigits * 20); 

                // Cap Max Time
                if (frames > 1800) frames = 1800;

                problemData = { question: visualStr + " = ?", answer: answer, maxTime: frames };
                isValid = true;
            }
            
            // Fallback if we somehow fail 300 times (unlikely)
            if (!isValid) return { question: "2 + 2 = ?", answer: 4, maxTime: 300 };
            return problemData;
        }
    };

    // --- BATTLE MANAGER MODS ---

    const _BattleManager_startAction = BattleManager.startAction;
    BattleManager.startAction = function() {
        if (this._subject) {
            this._subject._mathSolvedForThisTurn = false;
        }
        _BattleManager_startAction.call(this);
    };

    const _BattleManager_isBusy = BattleManager.isBusy;
    BattleManager.isBusy = function() {
        return _BattleManager_isBusy.call(this) || MathSystem.isMathPaused;
    };

    const _BattleManager_invokeAction = BattleManager.invokeAction;
    BattleManager.invokeAction = function(subject, target) {
        if (subject.isActor() && !this._action.isGuard() && !subject._mathSolvedForThisTurn) {
            
            MathSystem.isMathPaused = true;
            MathSystem.currentActorLevel = subject.level;
            
            const problem = MathSystem.generateProblem(subject.level);

            SceneManager._scene.startMathChallenge(problem, (result) => {
                
                MathSystem.forceCrit = false;
                MathSystem.forceMiss = false;

                if (result.correct) {
                    if (result.fast) {
                        MathSystem.resultMultiplier = 2.0;
                        MathSystem.forceCrit = true;
                        this._logWindow.addText("\\C[24]MATH GENIUS! (2x Crit)\\C[0]");
                    } else {
                        MathSystem.resultMultiplier = 1.0;
                        this._logWindow.addText("\\C[0]Correct, but slow.\\C[0]");
                    }
                } else {
                    if (result.fast) {
                        MathSystem.resultMultiplier = 0.5;
                        this._logWindow.addText("\\C[18]Wrong! (Weakened)\\C[0]");
                    } else {
                        MathSystem.resultMultiplier = 0.0;
                        MathSystem.forceMiss = true;
                        this._logWindow.addText("\\C[18]Wrong & Slow! (Miss)\\C[0]");
                    }
                }

                subject._mathSolvedForThisTurn = true;

                setTimeout(() => {
                    MathSystem.isMathPaused = false; 
                    _BattleManager_invokeAction.call(this, subject, target);
                }, 600);
            });

        } else {
            if (!subject.isActor()) {
                 MathSystem.resultMultiplier = 1.0;
                 MathSystem.forceCrit = false;
                 MathSystem.forceMiss = false;
            }
            _BattleManager_invokeAction.call(this, subject, target);
        }
    };

    // --- DAMAGE & HIT ---

    const _Game_Action_makeDamageValue = Game_Action.prototype.makeDamageValue;
    Game_Action.prototype.makeDamageValue = function(target, critical) {
        if (this.subject().isActor()) critical = MathSystem.forceCrit;
        let value = _Game_Action_makeDamageValue.call(this, target, critical);
        if (this.subject().isActor()) value = Math.floor(value * MathSystem.resultMultiplier);
        return value;
    };

    const _Game_Action_itemHit = Game_Action.prototype.itemHit;
    Game_Action.prototype.itemHit = function(target) {
        if (this.subject().isActor() && MathSystem.forceMiss) return 0;
        return _Game_Action_itemHit.call(this, target);
    };

    // --- WINDOW UI ---

    class Window_MathInput extends Window_Base {
        constructor(rect) {
            super(rect);
            this._inputValue = "";
            this._timer = 0;
            this.openness = 0; 
            this.active = false;
            this.hide();
            this.createContents();
        }

        setup(problem, callback) {
            this._problem = problem;
            this._callback = callback;
            this._inputValue = "";
            this._maxTime = problem.maxTime;
            this._timer = problem.maxTime;
            this._isSlow = false;
            this.show(); 
            this.open();
            this.active = true;
            this.refresh();
        }

        update() {
            super.update();
            if (!this.active) return;
            if (this._timer > 0) {
                this._timer--;
                this.refresh(); 
            } else {
                if (!this._isSlow) { this._isSlow = true; this.refresh(); }
            }
        }

        refresh() {
            this.contents.clear();
            const width = this.contentsWidth();
            const rate = this._timer / this._maxTime;
            const color1 = this._isSlow ? "#ff0000" : "#00ff00";
            
            this.drawGauge(0, 0, width, rate, color1, "#004400");
            
            this.changeTextColor(ColorManager.systemColor());
            this.drawText("Lv " + MathSystem.currentActorLevel, 0, 0, width, "right");
            
            this.changeTextColor(ColorManager.systemColor());
            this.drawText(this._problem.question, 0, 80, width, "center");
            
            this.changeTextColor(ColorManager.normalColor());
            this.drawText(this._inputValue + "_", 0, 120, width, "center");
        }

        drawGauge(x, y, width, rate, color1, color2) {
            const fillW = Math.floor(width * rate);
            this.contents.fillRect(x, y, width, 12, "#202020");
            this.contents.fillRect(x, y, fillW, 12, color1);
        }

        checkAnswer() {
            if (this._inputValue === "") return;
            const isCorrect = (parseInt(this._inputValue) === this._problem.answer);
            this.active = false;
            this.close(); 
            if (this._callback) this._callback({ correct: isCorrect, fast: (this._timer > 0) });
        }
    }

    // Global Key Listener
    const _Input_onKeyDown = Input._onKeyDown;
    Input._onKeyDown = function(event) {
        _Input_onKeyDown.call(this, event);
        if (SceneManager._scene instanceof Scene_Battle && SceneManager._scene._mathWindow && SceneManager._scene._mathWindow.active) {
            const win = SceneManager._scene._mathWindow;
            if (event.key >= '0' && event.key <= '9') {
                win._inputValue += event.key;
                win.refresh();
            }
            if (event.key === "-" || event.key === "_") {
                win._inputValue += "-";
                win.refresh();
            }
            if (event.key === "Backspace") {
                win._inputValue = win._inputValue.slice(0, -1);
                win.refresh();
            }
            if (event.key === "Enter") win.checkAnswer();
        }
    };

    const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
    Scene_Battle.prototype.createAllWindows = function() {
        _Scene_Battle_createAllWindows.call(this);
        const rect = new Rectangle((Graphics.boxWidth - 400)/2, (Graphics.boxHeight - 200)/2 - 100, 400, 200);
        this._mathWindow = new Window_MathInput(rect);
        this.addWindow(this._mathWindow);
    };

    Scene_Battle.prototype.startMathChallenge = function(problem, callback) {
        this._mathWindow.setup(problem, callback);
    };
})();