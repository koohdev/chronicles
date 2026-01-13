/*:
 * @target MZ
 * @plugindesc Adds a "Quests" option to the Main Menu to track Commissions and Story.
 * @author Gemini AI
 *
 * @param Main Story Variable
 * @desc The Variable ID used to store the current Main Story text.
 * @type variable
 * @default 25
 *
 * @help
 * ============================================================================
 * SIMPLE QUEST LOG
 * ============================================================================
 * * HOW TO USE:
 * 1. To set the "Main Story" objective, use [Control Variables].
 * Select Variable 25 (or whatever you set in parameters).
 * Set it to "Script" and type your text in quotes, or just "String".
 * * Example Event Command:
 * Control Variables [0025: Story] = "Go speak to the King in the castle."
 * * 2. The "Commission" section automatically updates based on the 
 * ProceduralQuestSystem plugin you are already using.
 */

(() => {
    const params = PluginManager.parameters('SimpleQuestLog');
    const VAR_STORY = Number(params['Main Story Variable']) || 25;

    // ========================================================================
    // 1. ADD "QUESTS" TO MAIN MENU
    // ========================================================================
    const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
    Window_MenuCommand.prototype.addOriginalCommands = function() {
        _Window_MenuCommand_addOriginalCommands.call(this);
        this.addCommand("Quests", "questLog", true);
    };

    const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
    Scene_Menu.prototype.createCommandWindow = function() {
        _Scene_Menu_createCommandWindow.call(this);
        this._commandWindow.setHandler("questLog", this.commandQuestLog.bind(this));
    };

    Scene_Menu.prototype.commandQuestLog = function() {
        SceneManager.push(Scene_QuestLog);
    };

    // ========================================================================
    // 2. THE QUEST LOG SCENE
    // ========================================================================
    class Scene_QuestLog extends Scene_MenuBase {
        create() {
            super.create();
            this.createQuestWindow();
        }

        createQuestWindow() {
            const rect = this.questWindowRect();
            this._questWindow = new Window_QuestDisplay(rect);
            this._questWindow.setHandler("cancel", this.popScene.bind(this));
            this.addWindow(this._questWindow);
        }

        questWindowRect() {
            const wx = 0;
            const wy = this.mainAreaTop();
            const ww = Graphics.boxWidth;
            const wh = this.mainAreaHeight();
            return new Rectangle(wx, wy, ww, wh);
        }
    }

    // ========================================================================
    // 3. THE QUEST WINDOW (DISPLAY)
    // ========================================================================
    class Window_QuestDisplay extends Window_Selectable {
        initialize(rect) {
            super.initialize(rect);
            this.refresh();
            this.activate();
        }

        refresh() {
            this.contents.clear();
            this.drawQuestInfo();
        }

        drawQuestInfo() {
            const width = this.innerWidth;
            let y = 0;
            const lineHeight = this.lineHeight();

            // --- SECTION 1: MAIN STORY ---
            this.changeTextColor(this.systemColor());
            this.drawText("MAIN STORY", 0, y, width, "center");
            this.resetTextColor();
            y += lineHeight;

            // Get text from Variable
            const storyText = $gameVariables.value(VAR_STORY);
            if (storyText && storyText !== 0) {
                this.drawTextEx(String(storyText), 20, y);
                y += lineHeight * 2;
            } else {
                this.drawText("No current objective.", 20, y, width, "left");
                y += lineHeight * 2;
            }

            // Draw Divider Line
            this.drawHorzLine(y + (lineHeight / 2));
            y += lineHeight * 1.5;

            // --- SECTION 2: ACTIVE COMMISSION ---
            this.changeTextColor(this.systemColor());
            this.drawText("ACTIVE COMMISSION", 0, y, width, "center");
            this.resetTextColor();
            y += lineHeight;

            // Check Procedural System Data
            const q = $gameSystem._pQuest;

            if (q && q.active) {
                // Draw Description
                // We strip the /C colors for the menu so it looks clean, or keep them if you prefer.
                // For now, we just draw the raw description.
                this.drawTextEx(q.desc, 20, y);
                y += lineHeight;

                // Draw Progress Bar / Text
                y += 10;
                let current = 0;
                
                // Real-time check
                if (q.type === "HUNT") {
                    current = q.amountCurrent;
                } else {
                    current = $gameParty.numItems($dataItems[q.targetId]);
                }

                // Cap current at needed
                if (current > q.amountNeeded) current = q.amountNeeded;

                const progressText = `Progress: ${current} / ${q.amountNeeded}`;
                
                // Color based on completion
                if (current >= q.amountNeeded) this.changeTextColor(ColorManager.textColor(24)); // Green
                else this.changeTextColor(ColorManager.normalColor());
                
                this.drawText(progressText, 20, y, width, "left");
                this.resetTextColor();

                y += lineHeight;
                
                // Draw Reward Info
                this.changeTextColor(ColorManager.textColor(6)); // Yellow
                this.drawText(`Reward: ${Math.floor(q.rewardGold)} G`, 20, y, width, "left");
                this.resetTextColor();

            } else {
                this.drawText("No active commissions.", 20, y, width, "left");
                this.drawText("(Visit an NPC to get work)", 20, y + lineHeight, width, "left");
            }
        }

        // Helper to draw a horizontal line
        drawHorzLine(y) {
            const lineY = y;
            this.contents.paintOpacity = 48;
            this.contents.fillRect(0, lineY, this.innerWidth, 2, ColorManager.normalColor());
            this.contents.paintOpacity = 255;
        }
    }
})();