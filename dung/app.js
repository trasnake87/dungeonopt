import { FightersSquad } from "./squads/FightersSquad.js";
import { MobsSquad } from "./squads/MobsSquad.js";
import { Battle } from "./battle/Battle.js";
import { Fighter, FighterClasses } from "./characters/Fighter.js";
import { I18nManager, formatString } from "./utils/i18n.js";

const fightersGridEl = document.getElementById("fightersGrid");
const verboseEl = document.getElementById("verbose");
const mobLevelEl = document.getElementById("mobLevel");
const numBattlesEl = document.getElementById("numBattles");
const outputEl = document.getElementById("output");
const fightBtn = document.getElementById("fightBtn");
const clearLogBtn = document.getElementById("clearLogBtn");

const apiKeyEl = document.getElementById("apiKey");
const importBtn = document.getElementById("importBtn");

const importConfirmModal = document.getElementById("importConfirmModal");
const confirmImportBtn = document.getElementById("confirmImport");
const cancelImportBtn = document.getElementById("cancelImport");
const dontShowImportWarningEl = document.getElementById(
  "dontShowImportWarning",
);

const fighterModal = document.getElementById("fighterModal");
const closeFighterModal = document.getElementById("closeFighterModal");
const saveFighterBtn = document.getElementById("saveFighter");
const fighterClassSelect = document.getElementById("fighterClass");
const fighterNameInput = document.getElementById("fighterName");

const benchGridEl = document.getElementById("benchGrid");
const addToBenchBtn = document.getElementById("addToBench");

const changelogLink = document.getElementById("changelogLink");
const changelogModal = document.getElementById("changelogModal");
const closeChangelog = document.getElementById("closeChangelog");
const lastUpdatedEl = document.getElementById("lastUpdated");

//Create i18n Manager
const I18N = new I18nManager();
let classDescriptions = null;
await I18N.initPromise;

// Now We Use I18nManager to load Descriptions ;D
I18N.initPromise.then(() => {
  classDescriptions = I18N.getClassDescription();
});

I18N.on("languageChanged", (event) => {
  classDescriptions = I18N.getClassDescription();
  renderGrid();
  renderBench();
});

// First register i18n Manager to global because other module may use it.
window.i18nManager = I18N;

// Create "COPY" image SVG
function createDuplicateIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path1.setAttribute(
    "d",
    "M15 3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z",
  );

  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path2.setAttribute(
    "d",
    "M19 7h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-2",
  );

  svg.appendChild(path1);
  svg.appendChild(path2);

  return svg;
}

// 在文件顶部附近添加辅助函数
function getNextDuplicateIndex() {
  let maxIndex = 0;

  // 检查战斗区的所有佣兵
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const fighter = gridState[i][j];
      if (fighter && fighter.poolIndex) {
        if (fighter.poolIndex > maxIndex) {
          maxIndex = fighter.poolIndex;
        }
      }
    }
  }

  // 检查替补区的所有佣兵
  benchState.forEach((fighter) => {
    if (fighter && fighter.poolIndex) {
      if (fighter.poolIndex > maxIndex) {
        maxIndex = fighter.poolIndex;
      }
    }
  });

  return maxIndex + 1;
}

// Create tooltip element
const classTooltip = document.createElement("div");
classTooltip.id = "classTooltip";
classTooltip.style.cssText = `
  position: absolute;
  background: linear-gradient(135deg, #2c3242 0%, #1a1e28 100%);
  color: #e6eaf3;
  border: 1px solid #4a5568;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  max-width: 280px;
  min-width: 200px;
  z-index: 1000;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease, transform 0.2s ease;
  transform: translateY(-5px);
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2);
  backdrop-filter: blur(4px);
  word-wrap: break-word;
`;
document.body.appendChild(classTooltip);

// Populate the original select for form compatibility
for (const value of Object.values(FighterClasses)) {
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = I18N.getFighterName(value.replace(" ", "_"));
  //opt.textContent = value;
  fighterClassSelect.appendChild(opt);
}

// Hide the original select and create custom dropdown
fighterClassSelect.style.display = "none";

// Create custom dropdown container
const customDropdown = document.createElement("div");
customDropdown.style.cssText = `
  position: relative;
  width: 100%;
`;

// Create custom dropdown button
const dropdownButton = document.createElement("button");
dropdownButton.type = "button";
dropdownButton.style.cssText = `
  width: 100%;
  padding: 0.5em 0.7em;
  border-radius: 6px;
  border: 1px solid #2c3242;
  background: #181c24;
  color: #e6eaf3;
  text-align: left;
  cursor: pointer;
  position: relative;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
`;
dropdownButton.innerHTML = `${I18N.getFighterName(FighterClasses.NONE)} <span style="float: right; transform: rotate(0deg); transition: transform 0.2s ease;">▼</span>`;

dropdownButton.addEventListener("mouseenter", () => {
  dropdownButton.style.borderColor = "#4a5568";
});

dropdownButton.addEventListener("mouseleave", () => {
  dropdownButton.style.borderColor = "#2c3242";
});

// Create dropdown options container
const dropdownOptions = document.createElement("div");
dropdownOptions.style.cssText = `
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #181c24;
  border: 1px solid #4a5568;
  border-top: none;
  border-radius: 0 0 6px 6px;
  z-index: 100;
  display: none;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
`;

// Create options
Object.values(FighterClasses).forEach((className) => {
  const option = document.createElement("div");
  option.style.cssText = `
    padding: 0.5em 0.7em;
    cursor: pointer;
    color: #e6eaf3;
    border-bottom: 1px solid #2c3242;
    transition: background-color 0.15s ease;
  `;
  option.textContent = I18N.getFighterName(
    className.replace(" ", "_").toUpperCase(),
  );
  option.dataset.i18n = `FighterName.${className.replace(" ", "_").toUpperCase()}`;
  option.dataset.value = className;

  // Hover effects
  option.addEventListener("mouseenter", (e) => {
    option.style.background = "#2c3242";
    const description = classDescriptions[className];
    if (description) {
      classTooltip.textContent = description;
      classTooltip.style.left = e.pageX + 10 + "px";
      classTooltip.style.top = e.pageY - 30 + "px";
      classTooltip.style.opacity = "1";
      classTooltip.style.visibility = "visible";
      classTooltip.style.transform = "translateY(0)";
    }
  });

  option.addEventListener("mousemove", (e) => {
    if (classTooltip.style.opacity === "1") {
      classTooltip.style.left = e.pageX + 10 + "px";
      classTooltip.style.top = e.pageY - 30 + "px";
    }
  });

  option.addEventListener("mouseleave", () => {
    option.style.background = "transparent";
    classTooltip.style.opacity = "0";
    classTooltip.style.visibility = "hidden";
    classTooltip.style.transform = "translateY(-5px)";
  });

  option.addEventListener("click", () => {
    fighterClassSelect.value = className;
    dropdownButton.innerHTML = `${I18N.getFighterName(className)} <span style="float: right;">▼</span>`;
    dropdownOptions.style.display = "none";
    dropdownButton.style.borderRadius = "6px";

    // Hide tooltip
    classTooltip.style.opacity = "0";
    classTooltip.style.visibility = "hidden";
    classTooltip.style.transform = "translateY(-5px)";

    // Trigger change event
    const event = new Event("change");
    fighterClassSelect.dispatchEvent(event);
  });

  dropdownOptions.appendChild(option);
});

// Toggle dropdown
dropdownButton.addEventListener("click", () => {
  const isOpen = dropdownOptions.style.display === "block";
  const arrow = dropdownButton.querySelector("span");
  if (isOpen) {
    dropdownOptions.style.display = "none";
    dropdownButton.style.borderRadius = "6px";
    dropdownButton.style.borderColor = "#2c3242";
    arrow.style.transform = "rotate(0deg)";
  } else {
    dropdownOptions.style.display = "block";
    dropdownButton.style.borderRadius = "6px 6px 0 0";
    dropdownButton.style.borderColor = "#4a5568";
    arrow.style.transform = "rotate(180deg)";
  }
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!customDropdown.contains(e.target)) {
    const arrow = dropdownButton.querySelector("span");
    dropdownOptions.style.display = "none";
    dropdownButton.style.borderRadius = "6px";
    dropdownButton.style.borderColor = "#2c3242";
    arrow.style.transform = "rotate(0deg)";
    classTooltip.style.opacity = "0";
    classTooltip.style.visibility = "hidden";
    classTooltip.style.transform = "translateY(-5px)";
  }
});

customDropdown.appendChild(dropdownButton);
customDropdown.appendChild(dropdownOptions);

// Insert custom dropdown after the original select
fighterClassSelect.parentNode.insertBefore(
  customDropdown,
  fighterClassSelect.nextSibling,
);

// Helper function to duplicate a fighter
/* function duplicateFighter(originalFighter) {
  if (!originalFighter) return null;

  // Create new fighter data with same stats
  const originalData = originalFighter.__raw || {};
  const duplicateData = { ...originalData };

  // Update the name
  duplicateData.name = formatString(
    I18N.getUIElement("DUPLICATE_NAME"),
    originalFighter.name,
  );
  //duplicateData.name = `Duplicate of ${originalFighter.name}`;

  // Create the duplicate fighter
  const duplicate = new Fighter(originalFighter.fighter_class, duplicateData);
  duplicate.__raw = { ...duplicateData };

  return duplicate;
} */
// Helper function to duplicate a fighter
function duplicateFighter(originalFighter) {
  if (!originalFighter) return null;

  // Create new fighter data with same stats
  const originalData = originalFighter.__raw || {};
  const duplicateData = { ...originalData };

  const nextIndex = getNextDuplicateIndex();
  duplicateData.isDuplicate = true;
  duplicateData.base = {
    name: originalFighter.name,
    fighter_class: originalFighter.fighter_class,
  };

  // 设置复制体的 poolIndex
  duplicateData.poolIndex = nextIndex;

  // Create the duplicate fighter
  const duplicate = new Fighter(originalFighter.fighter_class, duplicateData);
  duplicate.__raw = { ...duplicateData };

  return duplicate;
}

// Persistence Keys
const LS_KEYS = {
  grid: "dungeon:gridState:v1",
  bench: "dungeon:benchState:v1",
  mobLevel: "dungeon:mobLevel",
  numBattles: "dungeon:numBattles",
  verbose: "dungeon:verbose",
  apiKey: "dungeon:apiKey",
  dontShowImportWarning: "dungeon:dontShowImportWarning",
};

function serializeFighter(f) {
  if (!f) return null;
  // Save the raw input values that were stored when creating the fighter
  const raw = f.__raw || {};
  return {
    fighter_class: f.fighter_class,
    name: f.name,
    fighter_health: raw.fighter_health || 0,
    fighter_damage: raw.fighter_damage || 0,
    fighter_hit: raw.fighter_hit || 0,
    fighter_defense: raw.fighter_defense || 0,
    fighter_crit: raw.fighter_crit || 0,
    fighter_dodge: raw.fighter_dodge || 0,
    object_health: raw.object_health || 0,
    object_damage: raw.object_damage || 0,
    object_hit: raw.object_hit || 0,
    object_defense: raw.object_defense || 0,
    object_crit: raw.object_crit || 0,
    object_dodge: raw.object_dodge || 0,
    // 新增属性
    isDuplicate: f.isDuplicate || false,
    base: f.base || null,
    poolIndex: f.poolIndex || null,
  };
}

function deserializeFighter(obj) {
  if (!obj || !obj.fighter_class) return null;

  // Ensure all required fields exist with default values and are non-negative
  const data = {
    name: obj.name,
    fighter_health: Math.max(0, obj.fighter_health || 0),
    fighter_damage: Math.max(0, obj.fighter_damage || 0),
    fighter_hit: Math.max(0, obj.fighter_hit || 0),
    fighter_defense: Math.max(0, obj.fighter_defense || 0),
    fighter_crit: Math.max(0, obj.fighter_crit || 0),
    fighter_dodge: Math.max(0, obj.fighter_dodge || 0),
    object_health: Math.max(0, obj.object_health || 0),
    object_damage: Math.max(0, obj.object_damage || 0),
    object_hit: Math.max(0, obj.object_hit || 0),
    object_defense: Math.max(0, obj.object_defense || 0),
    object_crit: Math.max(0, obj.object_crit || 0),
    object_dodge: Math.max(0, obj.object_dodge || 0),
    // 新增属性
    isDuplicate: obj.isDuplicate || false,
    base: obj.base || null,
    poolIndex: obj.poolIndex || null,
  };

  try {
    const fighter = new Fighter(obj.fighter_class, data);
    // Store the raw input values for re-populating the form
    fighter.__raw = { ...data };
    return fighter;
  } catch (error) {
    console.warn("Failed to deserialize fighter:", obj, error); //ERR_FAIL_LOAD_FIGHTER
    return null;
  }
}

function saveState() {
  const raw = gridState.map((row) => row.map(serializeFighter));
  const benchRaw = benchState.map(serializeFighter);
  localStorage.setItem(LS_KEYS.grid, JSON.stringify(raw));
  localStorage.setItem(LS_KEYS.bench, JSON.stringify(benchRaw));
  localStorage.setItem(LS_KEYS.mobLevel, String(mobLevelEl.value || ""));
  localStorage.setItem(LS_KEYS.numBattles, String(numBattlesEl.value || ""));
  localStorage.setItem(LS_KEYS.verbose, verboseEl.checked ? "1" : "0");
  localStorage.setItem(LS_KEYS.apiKey, String(apiKeyEl.value || ""));
  localStorage.setItem(
    LS_KEYS.dontShowImportWarning,
    dontShowImportWarningEl.checked ? "1" : "0",
  );
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEYS.grid) || "null");
    if (Array.isArray(raw) && raw.length === 3) {
      for (let i = 0; i < 3; i++) {
        if (Array.isArray(raw[i]) && raw[i].length === 2) {
          for (let j = 0; j < 2; j++) {
            gridState[i][j] = deserializeFighter(raw[i][j]);
            // 如果没有 poolIndex，则分配一个
            if (gridState[i][j] && !gridState[i][j].poolIndex) {
              const index = getNextDuplicateIndex();
              gridState[i][j].poolIndex = index;
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn("Failed to load grid state:", error); //ERR_FAIL_LOAD_GRID
    // Clear corrupted data
    localStorage.removeItem(LS_KEYS.grid);
  }

  try {
    const benchRaw = JSON.parse(localStorage.getItem(LS_KEYS.bench) || "[]");
    if (Array.isArray(benchRaw)) {
      benchState.length = 0; // Clear array
      benchRaw.forEach((data) => {
        const fighter = deserializeFighter(data);
        if (fighter) {
          benchState.push(fighter);
          // 如果没有 poolIndex，则分配一个
          if (!fighter.poolIndex) {
            const index = getNextDuplicateIndex();
            fighter.poolIndex = index;
          }
        }
      });
    }
  } catch (error) {
    console.warn("Failed to load bench state:", error); //ERR_FAIL_LOAD_BENCH
    localStorage.removeItem(LS_KEYS.bench);
  }

  const mob = localStorage.getItem(LS_KEYS.mobLevel);
  const num = localStorage.getItem(LS_KEYS.numBattles);
  const ver = localStorage.getItem(LS_KEYS.verbose);
  const api = localStorage.getItem(LS_KEYS.apiKey);

  if (mob) {
    const mobValue = Math.max(1, parseInt(mob) || 1);
    mobLevelEl.value = mobValue;
  }
  if (num) {
    let numValue = Math.max(1, parseInt(num) || 1);
    if (numValue > 1000000) numValue = 1000000;
    numBattlesEl.value = numValue;
  }
  if (ver) verboseEl.checked = ver === "1";
  if (api) apiKeyEl.value = api;

  const dontShow = localStorage.getItem(LS_KEYS.dontShowImportWarning);
  if (dontShow) dontShowImportWarningEl.checked = dontShow === "1";
}

// State: 3x2 fighters grid
const gridState = Array.from({ length: 3 }, () =>
  Array.from({ length: 2 }, () => null),
);
// State: bench fighters (dynamic array)
const benchState = [];
let editingCell = { i: 0, j: 0 };
let editingBench = { index: -1, isAddNew: false };

function renderGrid() {
  fightersGridEl.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const cell = document.createElement("div");
      const fighter = gridState[i][j];

      // Apply different styling for empty vs filled cells
      if (fighter) {
        cell.className = "fighter-cell";
      } else {
        cell.className = "fighter-cell empty";
      }

      // Add drag and drop attributes
      cell.draggable = !!fighter;
      cell.dataset.gridPosition = `${i},${j}`;

      // Make the entire cell clickable to open editor
      cell.addEventListener("click", (e) => {
        // Prevent double-firing by checking if we clicked a button
        if (e.target.tagName === "BUTTON") {
          return;
        }
        openFighterEditor(i, j);
      });

      // Add drag over visual feedback
      cell.addEventListener("dragenter", (e) => {
        e.preventDefault();
        if (draggedData && cell !== draggedElement) {
          cell.classList.add("drag-over");
        }
      });

      cell.addEventListener("dragleave", (e) => {
        // Only remove if we're actually leaving the element
        if (!cell.contains(e.relatedTarget)) {
          cell.classList.remove("drag-over");
        }
      });

      // Add drag and drop event listeners
      if (fighter) {
        cell.addEventListener("dragstart", handleDragStart);
        cell.addEventListener("dragend", handleDragEnd);
      }
      cell.addEventListener("dragover", handleDragOver);
      cell.addEventListener("drop", handleDrop);

      const name = document.createElement("span");
      name.className = "name";

      if (fighter) {
        const fighterName = document.createElement("div");
        fighterName.textContent = fighter.name;

        const fighterDetails = document.createElement("div");
        fighterDetails.style.fontSize = "0.8em";
        fighterDetails.style.opacity = "0.7";

        if (fighter.isDuplicate && fighter.base) {
          const duplicateText = formatString(
            I18N.getUIElement("DUPLICATE_NAME"),
            fighter.base.name,
          );
          fighterDetails.textContent = `${I18N.getFighterName(fighter.fighter_class)} - ${duplicateText} #${fighter.poolIndex}`;
        } else {
          fighterDetails.textContent = `${I18N.getFighterName(fighter.fighter_class)} #${fighter.poolIndex}`;
        }

        name.appendChild(fighterName);
        name.appendChild(fighterDetails);
      } else {
        name.textContent = I18N.getFighterName("Empty");
      }

      cell.appendChild(name);

      if (fighter) {
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "fighter-buttons";

        const del = document.createElement("button");
        del.className = "btn small delete";
        del.dataset.i18n = `UIElement.DELETE`;
        del.textContent = I18N.getUIElement("Delete");
        del.style.width = "55px";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          gridState[i][j] = null;
          saveState();
          renderGrid();
          renderBench();
        });

        const duplicate = document.createElement("button");
        duplicate.className = "btn small duplicate";
        duplicate.dataset.i18n = `UIElement.DUPLICATE`;
        duplicate.title = I18N.getUIElement("Duplicate");
        duplicate.style.width = "55px";

        // 添加SVG图标
        duplicate.innerHTML = "";
        const duplicateIcon = createDuplicateIcon();
        duplicate.appendChild(duplicateIcon);

        duplicate.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const duplicatedFighter = duplicateFighter(fighter);
          if (duplicatedFighter) {
            benchState.push(duplicatedFighter);
            saveState();
            renderBench();
          }
        });

        buttonContainer.appendChild(del);
        buttonContainer.appendChild(duplicate);
        cell.appendChild(buttonContainer);
      } else {
        const add = document.createElement("button");
        add.className = "btn small add";
        add.dataset.i18n = "UIElement.ADD";
        add.textContent = I18N.getUIElement("Add");
        add.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          openFighterEditor(i, j);
        });
        cell.appendChild(add);
      }
      fightersGridEl.appendChild(cell);
    }
  }
}

function renderBench() {
  benchGridEl.innerHTML = "";

  // Add a placeholder when bench is empty to ensure drops work
  if (benchState.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "bench-fighter";
    placeholder.style.opacity = "0.3";
    placeholder.style.border = "2px dashed #36405a";
    placeholder.style.background = "transparent";
    placeholder.dataset.i18n = "UIElement.DROP_FIGHTER_HERE";
    placeholder.textContent = I18N.getUIElement("DROP_FIGHTER_HERE");
    placeholder.style.textAlign = "center";
    placeholder.style.color = "#8892b0";
    placeholder.style.fontSize = "0.9em";
    placeholder.style.minHeight = "60px";
    placeholder.style.display = "flex";
    placeholder.style.alignItems = "center";
    placeholder.style.justifyContent = "center";
    placeholder.style.borderRadius = "10px";
    placeholder.style.padding = "0 0.66em";
    placeholder.style.width = "100%"; // 占满整行

    // Make placeholder accept drops
    placeholder.addEventListener("dragover", handleDragOver);
    placeholder.addEventListener("drop", handleDrop);

    benchGridEl.appendChild(placeholder);
    return;
  }

  benchState.forEach((fighter, index) => {
    const benchItem = document.createElement("div");
    benchItem.className = "bench-fighter";
    benchItem.draggable = true;
    benchItem.dataset.benchIndex = index;
    benchItem.style.width = "100%"; // 确保占满整行

    benchItem.addEventListener("dragstart", handleDragStart);
    benchItem.addEventListener("dragend", handleDragEnd);
    benchItem.addEventListener("dragover", handleDragOver);
    benchItem.addEventListener("drop", handleDrop);

    // Add drag over visual feedback
    benchItem.addEventListener("dragenter", (e) => {
      e.preventDefault();
      if (draggedData && benchItem !== draggedElement) {
        benchItem.classList.add("drag-over");
      }
    });

    benchItem.addEventListener("dragleave", (e) => {
      if (!benchItem.contains(e.relatedTarget)) {
        benchItem.classList.remove("drag-over");
      }
    });

    // Click to edit
    benchItem.addEventListener("click", (e) => {
      if (e.target.tagName === "BUTTON") {
        return;
      }
      openBenchFighterEditor(index);
    });

    const nameContainer = document.createElement("div");
    nameContainer.style.flex = "1";
    nameContainer.style.display = "flex";
    nameContainer.style.alignItems = "center";
    nameContainer.style.justifyContent = "center";
    nameContainer.style.minWidth = "0";
    nameContainer.style.width = "100%"; // 占满空间

    const name = document.createElement("span");
    name.className = "name";
    name.style.textAlign = "center";
    name.style.width = "100%"; // 文本占满空间

    if (fighter) {
      const fighterName = document.createElement("div");
      fighterName.textContent = fighter.name;

      const fighterDetails = document.createElement("div");
      fighterDetails.style.fontSize = "0.8em";
      fighterDetails.style.opacity = "0.7";

      if (fighter.isDuplicate && fighter.base) {
        const duplicateText = formatString(
          I18N.getUIElement("DUPLICATE_NAME"),
          fighter.base.name,
        );
        fighterDetails.textContent = `${I18N.getFighterName(fighter.fighter_class)} - ${duplicateText} #${fighter.poolIndex}`;
      } else {
        fighterDetails.textContent = `${I18N.getFighterName(fighter.fighter_class)} #${fighter.poolIndex}`;
      }

      name.appendChild(fighterName);
      name.appendChild(fighterDetails);
    } else {
      name.textContent = I18N.getFighterName("Empty");
    }

    nameContainer.appendChild(name);
    benchItem.appendChild(nameContainer);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.flexDirection = "column";
    actions.style.alignItems = "center";
    actions.style.gap = "0.1em";
    actions.style.flexShrink = "0";

    const del = document.createElement("button");
    del.className = "btn small delete";
    del.textContent = "×";
    del.style.fontSize = "0.7em";
    del.style.padding = "0.2em";
    del.style.width = "20px";
    del.style.height = "20px";
    del.style.display = "flex";
    del.style.alignItems = "center";
    del.style.justifyContent = "center";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      benchState.splice(index, 1);
      saveState();
      renderBench();
    });

    const duplicate = document.createElement("button");
    duplicate.className = "btn small duplicate";
    duplicate.title = I18N.getUIElement("Duplicate");
    duplicate.style.padding = "0.2em";
    duplicate.style.width = "24px";
    duplicate.style.height = "24px";
    duplicate.style.display = "flex";
    duplicate.style.alignItems = "center";
    duplicate.style.justifyContent = "center";

    // 添加SVG图标
    duplicate.innerHTML = "";
    const duplicateIcon = createDuplicateIcon();
    duplicate.appendChild(duplicateIcon);

    duplicate.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const duplicatedFighter = duplicateFighter(fighter);
      if (duplicatedFighter) {
        benchState.push(duplicatedFighter);
        saveState();
        renderBench();
      }
    });

    actions.appendChild(del);
    actions.appendChild(duplicate);

    benchItem.appendChild(actions);
    benchGridEl.appendChild(benchItem);
  });
}

function openFighterEditor(i, j) {
  editingCell = { i, j };
  editingBench = { index: -1, isAddNew: false };
  const fighter = gridState[i][j];
  populateFighterModal(fighter);
  fighterModal.style.display = "flex";
}

function openBenchFighterEditor(index) {
  editingBench = { index, isAddNew: false };
  editingCell = { i: -1, j: -1 };
  const fighter = benchState[index];
  populateFighterModal(fighter);
  fighterModal.style.display = "flex";
}

function openAddToBenchEditor() {
  editingBench = { index: -1, isAddNew: true };
  editingCell = { i: -1, j: -1 };
  populateFighterModal(null);
  fighterModal.style.display = "flex";
}

function populateFighterModal(fighter) {
  fighterClassSelect.value = fighter
    ? fighter.fighter_class
    : FighterClasses.NONE;

  // Set the name field
  fighterNameInput.value = fighter ? fighter.name : "";

  // Update the custom dropdown button to match the selected value
  const customDropdown = fighterClassSelect.nextElementSibling;
  if (customDropdown) {
    const dropdownButton = customDropdown.querySelector("button");
    if (dropdownButton) {
      const selectedClass = fighter
        ? fighter.fighter_class
        : FighterClasses.NONE;
      dropdownButton.innerHTML = `${I18N.getFighterName(selectedClass.replace(" ", "_"))} <span style="float: right;">▼</span>`;
    }
  }

  const fields = [
    "fighter_health",
    "fighter_damage",
    "fighter_hit",
    "fighter_defense",
    "fighter_crit",
    "fighter_dodge",
    "object_health",
    "object_damage",
    "object_hit",
    "object_defense",
    "object_crit",
    "object_dodge",
  ];
  for (const id of fields) {
    const el = document.getElementById(id);
    // Always use the raw values for form population
    let value =
      fighter && fighter.__raw && typeof fighter.__raw[id] === "number"
        ? fighter.__raw[id]
        : 0;

    // Convert crit values for display
    if (id === "object_crit") {
      // Object crit: already stored as percentage points, round to 2 decimal places for display
      value = Math.round(value * 100) / 100;
    }

    el.value = value;
  }

  // Remove any existing event listeners to prevent stacking
  fighterClassSelect.onchange = null;

  // Add event listener for class change to auto-update name
  fighterClassSelect.onchange = function () {
    const currentName = fighterNameInput.value.trim();
    const newClass = fighterClassSelect.value;

    // Reset duplicate flag if class changes
    if (fighter && fighter.isDuplicate && fighter.fighter_class !== newClass) {
      fighter.isDuplicate = false;
      fighter.base = null;
    }

    // If name is empty or matches the old class, update it to the new class
    if (
      !currentName ||
      (fighter && currentName === fighter.fighter_class) ||
      (fighter && fighter.isDuplicate && currentName === fighter.base.name) ||
      (!fighter &&
        (!currentName || Object.values(FighterClasses).includes(currentName)))
    ) {
      fighterNameInput.value = I18N.getFighterName(newClass.replace(" ", "_"));
    }
  };
}

function closeFighterEditor() {
  // Clean up event listener to prevent memory leaks
  fighterClassSelect.onchange = null;
  editingCell = { i: -1, j: -1 };
  editingBench = { index: -1, isAddNew: false };
  fighterModal.style.display = "none";
}

saveFighterBtn.addEventListener("click", () => {
  const fc = fighterClassSelect.value;
  const fighterName = fighterNameInput.value.trim();

  // Create fighter data from form inputs
  const data = {};

  // Add name to data, use localized class name as default if no name provided
  data.name = fighterName || I18N.getFighterName(fc.replace(" ", "_"));

  const fields = [
    "fighter_health",
    "fighter_damage",
    "fighter_hit",
    "fighter_defense",
    "fighter_crit",
    "fighter_dodge",
    "object_health",
    "object_damage",
    "object_hit",
    "object_defense",
    "object_crit",
    "object_dodge",
  ];

  fields.forEach((field) => {
    const input = document.getElementById(field);
    if (input) {
      let value = Math.max(0, parseFloat(input.value) || 0);

      // Convert crit values back to raw storage format
      if (field === "object_crit") {
        // Object crit: keep as percentage points, round to 2 decimal places
        value = Math.round(value * 100) / 100;
      } else {
        // All other fields remain as integers
        value = Math.round(value);
      }

      data[field] = value;
    }
  });

  try {
    // Check if we're editing a duplicate fighter and the class has changed
    let isDuplicate = false;
    let base = null;

    if (editingCell.i >= 0 && editingCell.j >= 0) {
      const originalFighter = gridState[editingCell.i][editingCell.j];
      if (
        originalFighter &&
        originalFighter.isDuplicate &&
        originalFighter.fighter_class !== fc
      ) {
        // Class changed, reset duplicate status
        isDuplicate = false;
        base = null;
      } else if (originalFighter && originalFighter.isDuplicate) {
        // Class unchanged, keep duplicate status
        isDuplicate = true;
        base = originalFighter.base;
      }
    } else if (editingBench.index >= 0) {
      const originalFighter = benchState[editingBench.index];
      if (
        originalFighter &&
        originalFighter.isDuplicate &&
        originalFighter.fighter_class !== fc
      ) {
        // Class changed, reset duplicate status
        isDuplicate = false;
        base = null;
      } else if (originalFighter && originalFighter.isDuplicate) {
        // Class unchanged, keep duplicate status
        isDuplicate = true;
        base = originalFighter.base;
      }
    }

    // Add duplicate flag and base fighter if applicable
    if (isDuplicate) {
      data.isDuplicate = true;
      data.base = base;
    }

    // Create fighter with selected class (including "No Class")
    const f = new Fighter(fc, data);
    // Store raw inputs on instance for easy re-populating
    f.__raw = { ...data };

    // Determine where to save the fighter
    if (editingCell.i >= 0 && editingCell.j >= 0) {
      // Saving to main grid
      gridState[editingCell.i][editingCell.j] = f;
      renderGrid();
    } else if (editingBench.isAddNew) {
      // Adding new fighter to bench
      benchState.push(f);
      renderBench();
    } else if (editingBench.index >= 0) {
      // Editing existing bench fighter
      benchState[editingBench.index] = f;
      renderBench();
    }
  } catch (error) {
    console.error(I18N.getConsoleMsg("ERR_FAIL_CREA_FIGHTER"), error);
    alert(I18N.getAlertMsg("ERR_FAIL_CREA_FIGHTER"));
    return;
  }

  saveState();
  closeFighterEditor();
});

// Close modal when clicking the close button
closeFighterModal.addEventListener("click", closeFighterEditor);

// Close modal when clicking outside of it (on the backdrop)
fighterModal.addEventListener("click", (e) => {
  if (e.target === fighterModal) {
    closeFighterEditor();
  }
});

// Prevent modal from closing when clicking inside the modal content
fighterModal.querySelector(".modal").addEventListener("click", (e) => {
  e.stopPropagation();
});

function buildFightersSquad() {
  // Create fresh fighter instances for each battle to reset health and state
  const createFreshFighter = (fighter) => {
    if (!fighter) return null;
    // Create new fighter instance with same data to reset current_health and hit_counter
    const rawData = fighter.__raw || {};
    // Preserve the fighter's name
    rawData.name = fighter.name;
    return new Fighter(fighter.fighter_class, rawData);
  };

  // Map gridState to constructor order [[0,0],[0,1]],[ [1,0],[1,1] ], [ [2,0],[2,1] ]
  return new FightersSquad(
    createFreshFighter(gridState[0][0]),
    createFreshFighter(gridState[1][0]),
    createFreshFighter(gridState[2][0]),
    createFreshFighter(gridState[0][1]),
    createFreshFighter(gridState[1][1]),
    createFreshFighter(gridState[2][1]),
  );
}

function runBattles() {
  // Clear previous output immediately
  outputEl.textContent = "";
  outputEl.innerHTML = "";

  let level = Math.max(1, parseInt(mobLevelEl.value) || 1);
  let n = Math.max(1, parseInt(numBattlesEl.value) || 1);

  // Cap number of battles at 1,000,000
  if (n > 1000000) {
    n = 1000000;
    numBattlesEl.value = 1000000;
  }

  // Update display with corrected values
  mobLevelEl.value = level;
  // Don't update numBattlesEl.value here - keep user's input visible

  const verbose = verboseEl.checked;
  saveState();

  // Reset battle statistics completely
  let fighterWins = 0;
  let totalMobsHealth = 0;
  let battlesWithSurvivors = 0;
  let lastBattleLog = [];
  const originalConsoleLog = console.log;

  // If verbose is checked, always run only 1 battle with verbose output
  // Otherwise use the number from the field
  const actualBattlesToRun = verbose ? 1 : n;
  const shouldLogVerbose = verbose;

  try {
    if (shouldLogVerbose) {
      console.log = (...args) => {
        lastBattleLog.push(args.join(" "));
      };
    }

    for (let k = 0; k < actualBattlesToRun; k++) {
      // Create completely fresh squads for each battle
      const fighters = buildFightersSquad();
      const mobs = new MobsSquad(level);

      // Pass verbose flag only if we should log verbose
      const battle = new Battle(fighters, mobs, shouldLogVerbose ? 1 : 0);
      const battleResult = battle.battle();
      const [winner, rounds, message, mobHealth] = battleResult;

      if (winner === "fighters") {
        fighterWins += 1;
      }

      if (winner === "mobs") {
        totalMobsHealth += mobHealth;
        battlesWithSurvivors += 1;
      }
    }
  } finally {
    console.log = originalConsoleLog;
  }

  // Display results in the output field
  if (shouldLogVerbose) {
    //outputEl.textContent = lastBattleLog.join("\n");
    outputEl.innerHTML = lastBattleLog.join("\n");
    //console.warn(lastBattleLog.join("\n"));
  } else {
    const victoryChance = (fighterWins / actualBattlesToRun) * 100;
    const avgHealthSurvivors =
      battlesWithSurvivors > 0
        ? Math.round(totalMobsHealth / battlesWithSurvivors)
        : 0;

    const victoryLine = formatString(
      I18N.getUIElement("VICTORY_CHANCE"),
      victoryChance.toFixed(2),
    );
    const healthLine = formatString(
      I18N.getUIElement("AVG_SURVIVOR_HEALTH"),
      avgHealthSurvivors,
    );
    const chance60Min = formatString(
      I18N.getUIElement("CHANCE_60_MIN"),
      ((1.0 - (1.0 - victoryChance / 100.0) ** 60) * 100.0).toFixed(2),
    );

    outputEl.innerHTML = `${victoryLine}<br>${healthLine}<br>${chance60Min}`;
  }
}

fightBtn.addEventListener("click", runBattles);
clearLogBtn.addEventListener("click", () => {
  outputEl.textContent = "";
});

// API Import functionality
importBtn.addEventListener("click", () => {
  const apiKey = apiKeyEl.value.trim();

  if (!apiKey) {
    alert(I18N.getAlertMsg("ERR_NULL_API"));
    return;
  }

  // Check if user has opted to skip the warning
  const dontShow = localStorage.getItem(LS_KEYS.dontShowImportWarning);
  if (dontShow === "1") {
    // Skip confirmation modal and proceed directly
    performImport(apiKey);
  } else {
    // Show confirmation modal
    importConfirmModal.style.display = "flex";
  }
});

// Confirmation modal event handlers
confirmImportBtn.addEventListener("click", () => {
  // Save the "don't show anymore" preference
  if (dontShowImportWarningEl.checked) {
    localStorage.setItem(LS_KEYS.dontShowImportWarning, "1");
  }

  // Hide modal and proceed with import
  importConfirmModal.style.display = "none";
  const apiKey = apiKeyEl.value.trim();
  performImport(apiKey);
});

cancelImportBtn.addEventListener("click", () => {
  importConfirmModal.style.display = "none";
});

// Close modal when clicking outside of it (on the backdrop)
importConfirmModal.addEventListener("click", (e) => {
  if (e.target === importConfirmModal) {
    importConfirmModal.style.display = "none";
  }
});

// Prevent modal from closing when clicking inside
importConfirmModal.querySelector(".modal").addEventListener("click", (e) => {
  e.stopPropagation();
});

// Perform the actual API import
async function performImport(apiKey) {
  try {
    importBtn.disabled = true;
    importBtn.textContent = I18N.getUIElement("IMPORTING");

    const response = await fetch(
      "https://http.v2.queslar.com/api/character/fighter/presets",
      {
        method: "GET",
        headers: {
          "QUESLAR-API-KEY": apiKey,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        formatString(I18N.getAlertMsg("ERR_HTTP_ERROR"), response.status),
      ); //Alert.ERR_HTTP_ERROR
      //throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Process the imported data
    const result = processImportedData(data);
    if (!result.success) {
      console.warn(I18N.getConsoleMsg("ERR_IMPORT_FAIL"), result.message);
      alert(result.message);
    }
  } catch (error) {
    console.error(I18N.getConsoleMsg("ERR_IMPORT_FAIL"), error);
    alert(formatString(I18N.getAlertMsg("ERR_IMPORT_FAIL"), error.message));
    //alert(`Import failed: ${error.message}`);
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = I18N.getTranslation("import_button");
  }
}

// Process imported API data
function processImportedData(apiData) {
  try {
    // Check if output exists and is an array
    if (!apiData.output || !Array.isArray(apiData.output)) {
      return {
        success: false,
        message: I18N.getConsoleMsg("IVLD_API_FORMAT"),
      };
    }

    const dungeonPreset = apiData.output.find(
      (item) => item.preset && item.preset.assignment === "dungeon",
    );

    if (!dungeonPreset) {
      console.warn(
        I18N.getConsoleMsg("INFO_AVIL_PRESET"),
        apiData.output.map((item) => ({
          name: item.preset?.name,
          assignment: item.preset?.assignment,
        })),
      );
      return {
        success: false,
        message: I18N.getConsoleMsg("INFO_NO_AVIL_PRESET"),
      };
    }

    // Clear current grid state
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        gridState[i][j] = null;
      }
    }

    // Import fighters from the dungeon preset
    const fighters = dungeonPreset.fighters || [];
    let importedCount = 0;

    fighters.forEach((fighterData) => {
      try {
        const fighter = createFighterFromApiData(fighterData);
        if (fighter) {
          // Place fighter according to placement data, or find next available spot
          const placement = fighterData.placement;
          let placed = false;

          if (
            placement &&
            placement.row !== undefined &&
            placement.column !== undefined
          ) {
            // Temporarily invert row and column due to API bug
            const row = placement.column;
            const col = placement.row;

            // Validate placement bounds (0-2 rows, 0-1 columns)
            if (
              row >= 0 &&
              row < 3 &&
              col >= 0 &&
              col < 2 &&
              !gridState[row][col]
            ) {
              gridState[row][col] = fighter;
              placed = true;
              importedCount++;
            }
          }

          // If placement failed or wasn't specified, find first available spot
          if (!placed) {
            for (let i = 0; i < 3 && !placed; i++) {
              for (let j = 0; j < 2 && !placed; j++) {
                if (!gridState[i][j]) {
                  gridState[i][j] = fighter;
                  placed = true;
                  importedCount++;
                }
              }
            }
          }

          if (!placed) {
            console.warn(
              "Could not place fighter:",
              fighterData.name,
              "- grid is full",
            );
          }
        }
      } catch (error) {
        console.warn(
          "Failed to import fighter:",
          fighterData.name,
          error.message,
        );
      }
    });

    // Save state and re-render
    saveState();
    renderGrid();
    renderBench();

    return {
      success: true,
      fightersCount: importedCount,
    };
  } catch (error) {
    console.error("Error processing imported data:", error);
    return {
      success: false,
      // message: `Error processing imported data: ${error.message}`,
      message: formatString(
        I18N.getConsoleMsg("ERR_PROC_IMPORT_DATA"),
        error.message,
      ),
    };
  }
}

// Create Fighter instance from API data
function createFighterFromApiData(apiData) {
  try {
    // Validate basic required data
    if (!apiData || typeof apiData !== "object") {
      throw new Error(I18N.getConsoleMsg("ERR_IVLD_FIGHTER_DATA"));
      //throw new Error("Invalid fighter data: not an object");
    }

    if (!apiData.class || typeof apiData.class !== "string") {
      throw new Error(I18N.getConsoleMsg("ERR_IVLD_FIGHTER_CLS"));
      //throw new Error("Invalid or missing fighter class");
    }

    // Map API class names to our class names
    const classMapping = {
      assassin: "Assassin",
      brawler: "Brawler",
      hunter: "Hunter",
      mage: "Mage",
      priest: "Priest",
      shadow_dancer: "Shadow Dancer",
      shadowDancer: "Shadow Dancer", // Handle camelCase variant
      shadowdancer: "Shadow Dancer", // Handle lowercase variant
      berserker: "Berserker",
      paladin: "Paladin",
      crusader: "Crusader",
      sentinel: "Sentinel",
      bastion: "Bastion",
    };

    const fighterClass =
      classMapping[apiData.class.toLowerCase()] || "No Class";
    const stats = apiData.stats || {};
    const equipment = apiData.equipment || {};
    const equipmentStats = equipment.stats || [];

    // Calculate equipment stat bonuses
    let equipmentBonuses = {
      health: 0,
      damage: 0,
      hit: 0,
      defense: 0,
      critDamage: 0,
      dodge: 0,
    };

    // Tier multipliers for equipment stats
    const tierMultipliers = {
      1: 1.1,
      2: 1.2,
      3: 1.3,
      4: 1.4,
      5: 1.5,
      6: 1.75,
      7: 2,
      8: 2.25,
      9: 2.5,
      10: 2.75,
      11: 3,
      12: 3.5,
    };

    equipmentStats.forEach((stat) => {
      if (!stat || typeof stat !== "object" || !stat.type) return;

      const tier = Math.max(1, parseInt(stat.tier) || 1); // Ensure tier is at least 1
      const multiplier = tierMultipliers[tier] || 1.0; // Default to 1.0 if tier not found

      let baseValue, value;
      if (
        stat.type.toLowerCase() === "critdamage" ||
        stat.type.toLowerCase() === "crit_damage" ||
        stat.type.toLowerCase() === "critical_damage"
      ) {
        // Handle crit damage as decimal value, convert to percentage points for storage
        baseValue = Math.max(0, parseFloat(stat.value) || 0);
        value = baseValue * multiplier * 100; // Convert to percentage points
      } else {
        // Handle other stats as integers
        baseValue = Math.max(0, parseInt(stat.value) || 0);
        value = Math.round(baseValue * multiplier);
      }

      if (tier > 12) {
        console.warn(
          `Equipment stat has tier ${tier} which is above max (12), using default multiplier 1.0`,
        );
      }

      switch (stat.type.toLowerCase()) {
        case "health":
          equipmentBonuses.health += value;
          break;
        case "damage":
          equipmentBonuses.damage += value;
          break;
        case "hit":
          equipmentBonuses.hit += value;
          break;
        case "defense":
        case "defence": // Handle both spellings
          equipmentBonuses.defense += value;
          break;
        case "critdamage":
        case "crit_damage":
        case "critical_damage":
          equipmentBonuses.critDamage += value;
          break;
        case "dodge":
        case "evasion": // Alternative name for dodge
          equipmentBonuses.dodge += value;
          break;
        default:
          console.warn(
            "Unknown equipment stat type:",
            stat.type,
            "with value:",
            value,
          );
          break;
      }
    });

    // Create fighter data object for our Fighter constructor
    // Convert API stats (which appear to be allocations) to our fighter stat format
    const fighterData = {
      name: (apiData.name || fighterClass).trim() || fighterClass,
      // Convert API stats to allocation points (direct values, not divided by 50)
      // Ensure values are within reasonable bounds (0-20 allocation points)
      fighter_health: Math.max(0, parseInt(stats.health || 0)),
      fighter_damage: Math.max(0, parseInt(stats.damage || 0)),
      fighter_hit: Math.max(0, parseInt(stats.hit || 0)),
      fighter_defense: Math.max(0, parseInt(stats.defense || 0)),
      fighter_crit: Math.max(0, parseInt(stats.critDamage || 0)),
      fighter_dodge: Math.max(0, parseInt(stats.dodge || 0)),
      // Equipment bonuses (ensure they are non-negative)
      object_health: Math.max(0, equipmentBonuses.health),
      object_damage: Math.max(0, equipmentBonuses.damage),
      object_hit: Math.max(0, equipmentBonuses.hit),
      object_defense: Math.max(0, equipmentBonuses.defense),
      object_crit: Math.max(0, equipmentBonuses.critDamage),
      object_dodge: Math.max(0, equipmentBonuses.dodge),
      // Assign pool ID for imported fighter
      poolIndex: getNextDuplicateIndex(),
    };

    const fighter = new Fighter(fighterClass, fighterData);
    fighter.__raw = { ...fighterData }; // Store raw data for form re-population

    return fighter;
  } catch (error) {
    console.error("Error creating fighter from API data:", error, apiData);
    throw error;
  }
}

// Changelog functionality
async function loadChangelog() {
  try {
    const response = await fetch("./changelog.txt");
    const content = await response.text();
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    let html = "";
    let currentDate = "";
    let latestDate = "";

    for (const line of lines) {
      // Check if line is a date (YYYY-MM-DD format)
      if (/^\d{4}-\d{2}-\d{2}$/.test(line.trim())) {
        currentDate = line.trim();
        if (!latestDate) latestDate = currentDate;
        html += `<h4 style="margin-top: 1.5em; margin-bottom: 0.5em; color: #4fa3ff;">${currentDate}</h4>`;
      } else if (line.startsWith("-")) {
        // Convert hyphen to bullet point
        const entry = line.substring(1).trim();
        html += `<div style="margin-left: 1em; margin-bottom: 0.3em;">• ${entry}</div>`;
      } else if (line.trim()) {
        // Regular line
        html += `<div style="margin-left: 1em; margin-bottom: 0.3em;">• ${line.trim()}</div>`;
      }
    }

    // Update changelog modal content
    const changelogContent = changelogModal.querySelector(
      ".modal div:last-child",
    );
    changelogContent.innerHTML = html || "<p>No changelog entries found.</p>";

    // Update last updated date in footer
    if (latestDate && lastUpdatedEl) {
      lastUpdatedEl.textContent = `Last updated: ${latestDate}`;
    }
  } catch (error) {
    console.warn("Failed to load changelog:", error);
    const changelogContent = changelogModal.querySelector(
      ".modal div:last-child",
    );
    changelogContent.innerHTML = "<p>Unable to load changelog.</p>";
  }
}

changelogLink.addEventListener("click", () => {
  changelogModal.style.display = "flex";
});
closeChangelog.addEventListener("click", () => {
  changelogModal.style.display = "none";
});

// Close changelog modal when clicking outside
changelogModal.addEventListener("click", (e) => {
  if (e.target === changelogModal) {
    changelogModal.style.display = "none";
  }
});

// Prevent changelog modal from closing when clicking inside
changelogModal.querySelector(".modal").addEventListener("click", (e) => {
  e.stopPropagation();
});

// Input validation and persistence
mobLevelEl.addEventListener("input", () => {
  let value = Math.max(1, parseInt(mobLevelEl.value) || 1);
  if (mobLevelEl.value != value) {
    mobLevelEl.value = value;
  }
  saveState();
});

numBattlesEl.addEventListener("input", () => {
  let value = Math.max(1, parseInt(numBattlesEl.value) || 1);
  if (value > 1000000) {
    value = 1000000;
  }
  if (numBattlesEl.value != value) {
    numBattlesEl.value = value;
  }
  saveState();
});

verboseEl.addEventListener("input", saveState);
apiKeyEl.addEventListener("input", saveState);
dontShowImportWarningEl.addEventListener("change", saveState);

// Drag and drop functionality
let draggedElement = null;
let draggedData = null;

function handleDragStart(e) {
  draggedElement = e.target;
  e.target.classList.add("dragging");

  // Determine what we're dragging
  if (e.target.dataset.gridPosition) {
    const [i, j] = e.target.dataset.gridPosition.split(",").map(Number);
    draggedData = {
      type: "grid",
      position: { i, j },
      fighter: gridState[i][j],
    };
  } else if (e.target.dataset.benchIndex !== undefined) {
    const index = parseInt(e.target.dataset.benchIndex);
    draggedData = {
      type: "bench",
      index: index,
      fighter: benchState[index],
    };
  }

  e.dataTransfer.effectAllowed = "move";
}

function handleDragEnd(e) {
  e.target.classList.remove("dragging");
  // Remove drag-over class from all elements
  document.querySelectorAll(".drag-over").forEach((el) => {
    el.classList.remove("drag-over");
  });
  draggedElement = null;
  draggedData = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function handleDrop(e) {
  e.preventDefault();

  if (!draggedData) return;

  const dropTarget = e.currentTarget;
  dropTarget.classList.remove("drag-over");

  // Determine drop target
  let targetType = null;
  let targetData = null;

  if (dropTarget.dataset.gridPosition) {
    const [i, j] = dropTarget.dataset.gridPosition.split(",").map(Number);
    targetType = "grid";
    targetData = { i, j, fighter: gridState[i][j] };
  } else if (dropTarget.dataset.benchIndex !== undefined) {
    const index = parseInt(dropTarget.dataset.benchIndex);
    targetType = "bench";
    targetData = { index, fighter: benchState[index] };
  } else if (
    dropTarget === benchGridEl ||
    dropTarget.textContent === "Drop fighters here"
  ) {
    // Dropping on empty bench area or placeholder
    targetType = "benchEmpty";
    targetData = null;
  }

  // Handle the drop based on source and target
  if (draggedData.type === "grid" && targetType === "grid") {
    // Grid to grid - swap fighters
    const sourceFighter =
      gridState[draggedData.position.i][draggedData.position.j];
    const targetFighter = gridState[targetData.i][targetData.j];

    gridState[draggedData.position.i][draggedData.position.j] = targetFighter;
    gridState[targetData.i][targetData.j] = sourceFighter;

    renderGrid();
  } else if (
    draggedData.type === "grid" &&
    (targetType === "bench" || targetType === "benchEmpty")
  ) {
    // Grid to bench - move fighter to bench, leave grid empty
    const sourceFighter =
      gridState[draggedData.position.i][draggedData.position.j];
    gridState[draggedData.position.i][draggedData.position.j] = null;

    if (targetType === "bench") {
      // Insert at target position in bench
      benchState.splice(targetData.index, 0, sourceFighter);
    } else {
      // Add to end of bench if dropping on empty area
      benchState.push(sourceFighter);
    }

    renderGrid();
    renderBench();
  } else if (draggedData.type === "bench" && targetType === "grid") {
    // Bench to grid - move fighter to grid, remove from bench
    const sourceFighter = benchState[draggedData.index];
    const targetFighter = targetData.fighter;

    // Remove from bench
    benchState.splice(draggedData.index, 1);

    // If target grid position has a fighter, add it to the bench at the same position
    if (targetFighter) {
      benchState.splice(draggedData.index, 0, targetFighter);
    }

    // Place the dragged fighter in the grid
    gridState[targetData.i][targetData.j] = sourceFighter;

    renderGrid();
    renderBench();
  } else if (draggedData.type === "bench" && targetType === "bench") {
    // Bench to bench - reorder
    if (draggedData.index !== targetData.index) {
      const sourceFighter = benchState[draggedData.index];
      benchState.splice(draggedData.index, 1);
      benchState.splice(targetData.index, 0, sourceFighter);
      renderBench();
    }
  }

  saveState();
}

// Add visual feedback for bench grid when dragging from grid
benchGridEl.addEventListener("dragenter", (e) => {
  e.preventDefault();
  if (draggedData && draggedData.type === "grid") {
    benchGridEl.style.border = "2px dashed #4fa3ff";
    benchGridEl.style.backgroundColor = "rgba(79, 163, 255, 0.1)";
  }
});

benchGridEl.addEventListener("dragleave", (e) => {
  if (!benchGridEl.contains(e.relatedTarget)) {
    benchGridEl.style.border = "";
    benchGridEl.style.backgroundColor = "";
  }
});

// Add drop handling to bench grid container for empty area drops
benchGridEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
});

benchGridEl.addEventListener("drop", (e) => {
  e.preventDefault();

  // Reset visual feedback
  benchGridEl.style.border = "";
  benchGridEl.style.backgroundColor = "";

  if (!draggedData) return;

  // Only handle drops from grid to bench (adding to end)
  if (draggedData.type === "grid") {
    const sourceFighter =
      gridState[draggedData.position.i][draggedData.position.j];
    gridState[draggedData.position.i][draggedData.position.j] = null;

    // Add to end of bench
    benchState.push(sourceFighter);

    renderGrid();
    renderBench();
    saveState();
  }
});

// Add to bench button event
addToBenchBtn.addEventListener("click", openAddToBenchEditor);

// Add comprehensive validation to all fighter stat inputs
const statInputIds = [
  "fighter_health",
  "fighter_damage",
  "fighter_hit",
  "fighter_defense",
  "fighter_crit",
  "fighter_dodge",
  "object_health",
  "object_damage",
  "object_hit",
  "object_defense",
  "object_crit",
  "object_dodge",
];

function validateStatInput(input) {
  // Handle crit fields
  if (input.id === "object_crit") {
    // Object crit: decimal percentage values
    let value = Math.max(0, parseFloat(input.value) || 0);
    value = Math.round(value * 100) / 100; // Round to 2 decimal places
    if (Math.abs(parseFloat(input.value) - value) > 0.01) {
      input.value = value;
    }
  } else {
    // Integer validation for all other fields
    let value = Math.max(0, parseInt(input.value) || 0);
    if (input.value != value) {
      input.value = value;
    }
  }
}

statInputIds.forEach((inputId) => {
  const input = document.getElementById(inputId);
  if (input) {
    // Real-time validation
    input.addEventListener("input", () => validateStatInput(input));

    // Validation on paste
    input.addEventListener("paste", () => {
      setTimeout(() => validateStatInput(input), 0);
    });

    // Validation on blur (when user leaves the field)
    input.addEventListener("blur", () => validateStatInput(input));
  }
});

// Also add validation for mob level and number of battles on blur and paste
mobLevelEl.addEventListener("blur", () => {
  let value = Math.max(1, parseInt(mobLevelEl.value) || 1);
  if (mobLevelEl.value != value) {
    mobLevelEl.value = value;
  }
});

mobLevelEl.addEventListener("paste", () => {
  setTimeout(() => {
    let value = Math.max(1, parseInt(mobLevelEl.value) || 1);
    if (mobLevelEl.value != value) {
      mobLevelEl.value = value;
    }
  }, 0);
});

numBattlesEl.addEventListener("blur", () => {
  let value = Math.max(1, parseInt(numBattlesEl.value) || 1);
  if (value > 1000000) {
    value = 1000000;
  }
  if (numBattlesEl.value != value) {
    numBattlesEl.value = value;
  }
});

numBattlesEl.addEventListener("paste", () => {
  setTimeout(() => {
    let value = Math.max(1, parseInt(numBattlesEl.value) || 1);
    if (value > 1000000) {
      value = 1000000;
    }
    if (numBattlesEl.value != value) {
      numBattlesEl.value = value;
    }
  }, 0);
});

loadState();
renderGrid();
renderBench();
loadChangelog();
