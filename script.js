// --- Global State ---
        let dragSrcEl = null;
        let isInternal = false;
        let stopFlag = false;
        let knownVars = ['pontos', 'i'];
        let globalVars = { 'pontos': 0, 'i': 0 }; 
        let activeContext = null;
        let labelsMap = {}; // Maps label names to block elements

        // Sprite State
        const STAGE_W = 450;
        const STAGE_H = 320;
        let spriteState = { x: 0, y: 0, dir: 90, size: 100, color: 'transparent' };

        function init() {
            document.querySelectorAll('#palette-scroll [draggable="true"]').forEach(el => {
                setupBlockEvents(el);
                el.querySelectorAll('input, select').forEach(i => {
                    i.setAttribute('disabled', 'true');
                    i.style.pointerEvents = 'none';
                });
            });
            updateVarSelects();
            updateMonitorUI();
            updateSpriteVisuals();
        }

        // --- DnD Core ---
        function setupBlockEvents(el) {
            el.addEventListener('dragstart', handleDragStart);
            el.addEventListener('dragend', handleDragEnd);
        }
        
        function handleDragStart(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') { e.preventDefault(); return false; }
            e.stopPropagation();
            dragSrcEl = this;
            e.dataTransfer.effectAllowed = 'copyMove';
            e.dataTransfer.setData('text/plain', 'block');
            const workspace = document.getElementById('script-zone');
            if (workspace.contains(this)) {
                isInternal = true;
                this.classList.add('dragging');
                setTimeout(() => this.style.opacity = '0', 0);
            } else {
                isInternal = false;
            }
        }

        function handleDragEnd(e) {
            e.stopPropagation();
            if (dragSrcEl) {
                dragSrcEl.classList.remove('dragging');
                dragSrcEl.style.opacity = '1';
            }
            document.getElementById('drag-indicator').style.display = 'none';
            document.getElementById('trash-zone').classList.remove('bg-red-100');
            dragSrcEl = null;
            isInternal = false;
        }

        const workspace = document.getElementById('workspace-container');
        const trash = document.getElementById('trash-zone');
        
        trash.addEventListener('dragover', e => { e.preventDefault(); trash.classList.add('bg-red-100'); });
        trash.addEventListener('dragleave', () => trash.classList.remove('bg-red-100'));
        trash.addEventListener('drop', e => { e.preventDefault(); if (isInternal && dragSrcEl) dragSrcEl.remove(); });

        workspace.addEventListener('dragover', e => {
            e.preventDefault();
            if(!dragSrcEl) return;
            const targetContainer = e.target.closest('.c-mouth, #script-zone');
            if(targetContainer) {
                const ind = document.getElementById('drag-indicator');
                const after = getDragAfterElement(targetContainer, e.clientY);
                ind.style.display = 'block';
                const rect = after ? after.getBoundingClientRect() : (targetContainer.lastElementChild ? targetContainer.lastElementChild.getBoundingClientRect() : targetContainer.getBoundingClientRect());
                const offset = after ? 0 : (targetContainer.children.length ? 30 : 10);
                
                const wsRect = workspace.getBoundingClientRect();
                ind.style.top = (rect.top - wsRect.top + workspace.scrollTop - (after?4:-offset)) + 'px';
                ind.style.left = (rect.left - wsRect.left + workspace.scrollLeft) + 'px';
                ind.style.width = (after ? rect.width : 50) + 'px';
            }
        });

        workspace.addEventListener('drop', e => {
            e.preventDefault();
            document.getElementById('drag-indicator').style.display = 'none';
            const targetContainer = e.target.closest('.c-mouth, #script-zone');
            if (!targetContainer) return;
            if (isInternal && dragSrcEl.contains(targetContainer)) return;

            let newBlock = isInternal ? dragSrcEl : dragSrcEl.cloneNode(true);
            if (!isInternal) {
                setupBlockEvents(newBlock);
                setupInputEvents(newBlock);
            }
            newBlock.style.opacity = '1';
            document.getElementById('start-hint').style.display = 'none';

            const after = getDragAfterElement(targetContainer, e.clientY);
            if (after) targetContainer.insertBefore(newBlock, after);
            else targetContainer.appendChild(newBlock);
        });

        function getDragAfterElement(container, y) {
            const els = [...container.children].filter(c => c !== dragSrcEl && !c.classList.contains('drop-indicator') && c.id !== 'start-hint');
            return els.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
                else return closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }

        function setupInputEvents(el) {
            el.querySelectorAll('input, select').forEach(inp => {
                inp.removeAttribute('disabled');
                inp.style.pointerEvents = 'auto';
                inp.addEventListener('mousedown', e => e.stopPropagation());
                inp.addEventListener('click', e => e.stopPropagation());
                inp.addEventListener('focus', () => { el.setAttribute('draggable', 'false'); el.classList.add('ring-2', 'ring-blue-400'); });
                inp.addEventListener('blur', () => { el.setAttribute('draggable', 'true'); el.classList.remove('ring-2', 'ring-blue-400'); });
            });
        }

        // --- Vars ---
        async function createVariable() {
            const name = await customPrompt("Nome da variável:");
            if (name) {
                const clean = name.replace(/[^a-zA-Z0-9]/g, '');
                if(clean && !knownVars.includes(clean)) {
                    knownVars.push(clean);
                    globalVars[clean] = 0;
                    updateVarSelects();
                    updateMonitorUI();
                    saveToLocalStorage();
                }
            }
        }

        function updateVarSelects() {
            document.querySelectorAll('.var-select').forEach(sel => {
                const val = sel.value;
                sel.innerHTML = '';
                knownVars.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v; opt.innerText = v;
                    sel.appendChild(opt);
                });
                if(knownVars.includes(val)) sel.value = val;
            });
        }

        function updateMonitorUI() {
            const mon = document.getElementById('var-monitor');
            mon.innerHTML = '';
            const src = activeContext ? activeContext.vars : globalVars;
            
            Object.keys(src).forEach(k => {
                const row = document.createElement('div');
                row.className = "flex justify-between items-center bg-white p-2 rounded border border-slate-200 shadow-sm";
                row.innerHTML = `<span class="font-bold text-slate-600">${k}</span>`;
                
                const inp = document.createElement('input');
                inp.type = 'number';
                inp.className = "text-right w-16 font-mono text-indigo-600 bg-transparent focus:bg-indigo-50 rounded px-1 outline-none font-bold";
                inp.value = src[k];
                inp.onchange = (e) => {
                    const val = parseFloat(e.target.value);
                    if(activeContext) activeContext.vars[k] = val;
                    else globalVars[k] = val;
                    saveToLocalStorage();
                };
                row.appendChild(inp);
                mon.appendChild(row);
            });
        }

        // --- Visuals ---
        function updateSpriteVisuals() {
            const sprite = document.getElementById('sprite-1');
            const cssLeft = (STAGE_W / 2) + spriteState.x;
            const cssTop = (STAGE_H / 2) - spriteState.y; 
            
            sprite.style.left = `${cssLeft}px`;
            sprite.style.top = `${cssTop}px`;
            sprite.style.transform = `translate(-50%, -50%) rotate(${spriteState.dir - 90}deg) scale(${spriteState.size / 100})`;
            
            const img = sprite.querySelector('img');
            if (spriteState.color && spriteState.color !== 'transparent') {
                img.style.filter = `drop-shadow(0px 0px 15px ${spriteState.color})`;
            } else {
                img.style.filter = 'none';
            }
            
            document.getElementById('coord-x').innerText = Math.round(spriteState.x);
            document.getElementById('coord-y').innerText = Math.round(spriteState.y);
            document.getElementById('coord-dir').innerText = Math.round(spriteState.dir);
        }

        // --- Interpreter ---
        async function runSimulation() {
            stopFlag = false;
            
            
            activeContext = { vars: {...globalVars}, funcs: {} };
            labelsMap = {};

            // 1. Scan Labels & Functions
            document.querySelectorAll('#script-zone .block[data-type="control_label"]').forEach(b => {
                const name = b.querySelector('input').value.trim();
                if(name) labelsMap[name] = b;
            });
            document.querySelectorAll('#script-zone .block-hat[data-type="func_def"]').forEach(b => {
                const name = b.querySelector('input').value.trim();
                if(name) activeContext.funcs[name] = b;
            });

            updateMonitorUI();

            const startBlock = document.querySelector('#script-zone .block-hat[data-type="event_start"]');
            if(!startBlock) { console.error("Erro: Sem bloco 'Quando Clicar'"); return; }

            try {
                // We wrap execution in a loop to handle GOTO jumps (stack unwinding)
                let nextToExec = startBlock.nextElementSibling;
                
                while(nextToExec && !stopFlag) {
                    try {
                        // Execute the linear stack
                        await executeStack(nextToExec, activeContext);
                        break; // If finished normally, exit loop
                    } catch (e) {
                        if (e.type === 'GOTO') {
                            console.warn(`Saltando para: ${e.targetName}`);
                            nextToExec = e.targetBlock; // Resume main loop at target
                        } else {
                            throw e;
                        }
                    }
                }
            } catch(e) {
                console.error("Erro: " + e.message);
            }
            activeContext = null;
            updateMonitorUI();
        }

        function stopSimulation() { stopFlag = true; console.warn("Parado."); }

        

        async function executeStack(node, ctx) {
            let cur = node;
            while(cur && !stopFlag) {
                if(cur.classList.contains('block') || cur.classList.contains('block-c-wrap')) {
                    cur.classList.add('ring-2', 'ring-yellow-400');
                    await executeBlock(cur, ctx);
                    await new Promise(r => setTimeout(r, 10)); 
                    cur.classList.remove('ring-2', 'ring-yellow-400');
                }
                cur = cur.nextElementSibling;
            }
        }

        async function executeBlock(b, ctx) {
            const type = b.dataset.type;
            const inputs = b.querySelectorAll('input, select');
            const val = (i) => evaluate(inputs[i].value, ctx);

            switch(type) {
                // MOTION
                case 'motion_move':
                    const steps = val(0);
                    const rad = (spriteState.dir - 90) * (Math.PI / 180);
                    spriteState.x += steps * Math.cos(rad);
                    spriteState.y -= steps * Math.sin(rad); 
                    updateSpriteVisuals();
                    break;
                case 'motion_turn_right': spriteState.dir += val(0); updateSpriteVisuals(); break;
                case 'motion_goto': spriteState.x = val(0); spriteState.y = val(1); updateSpriteVisuals(); break;
                
                // LOOKS
                case 'looks_say':
                    const msg = inputs[0].value;
                    const sec = val(1);
                    const bubble = document.getElementById('sprite-bubble');
                    bubble.innerText = msg; bubble.classList.remove('hidden');
                    await new Promise(r => setTimeout(r, sec * 1000));
                    bubble.classList.add('hidden');
                    break;
                case 'looks_color':
                    spriteState.color = inputs[0].value;
                    updateSpriteVisuals();
                    break;

                // CONTROL
                case 'control_wait': await new Promise(r => setTimeout(r, val(0)*1000)); break;
                
                case 'control_repeat':
                    const times = val(0);
                    const mouthR = b.querySelector('.c-mouth');
                    if(mouthR.firstElementChild) {
                        for(let i=0; i<times; i++) {
                            if(stopFlag) break;
                            await executeStack(mouthR.firstElementChild, ctx);
                        }
                    }
                    break;

                case 'control_if':
                    if(val(0)) {
                        const mouthIf = b.querySelector('.c-mouth');
                        if(mouthIf.firstElementChild) await executeStack(mouthIf.firstElementChild, ctx);
                    }
                    break;

                case 'control_do_while':
                    const mouthDo = b.querySelector('.c-mouth');
                    const conditionStr = inputs[0].value; // Get raw string to eval each time
                    if (mouthDo.firstElementChild) {
                        do {
                            if (stopFlag) break;
                            await executeStack(mouthDo.firstElementChild, ctx);
                            await new Promise(r => setTimeout(r, 0)); // Yield to allow stop
                        } while (evaluate(conditionStr, ctx));
                    }
                    break;

                case 'control_label':
                    // No-op, just a marker
                    break;

                case 'control_goto':
                    const labelName = inputs[0].value.trim();
                    if (labelsMap[labelName]) {
                        // Special GOTO Exception to break recursion
                        throw { type: 'GOTO', targetBlock: labelsMap[labelName], targetName: labelName };
                    } else {
                        console.error(`Erro: Marcador '${labelName}' não encontrado`);
                    }
                    break;

                // VARS & LOG & MATH
                case 'var_set': ctx.vars[inputs[0].value] = val(1); updateMonitorUI(); break;
                case 'var_set_random': 
                    const min = val(1); const max = val(2);
                    ctx.vars[inputs[0].value] = Math.floor(Math.random() * (max - min + 1)) + min;
                    updateMonitorUI(); 
                    break;
                case 'var_change': 
                    const v = inputs[1].value; 
                    ctx.vars[v] = (ctx.vars[v]||0) + val(0); 
                    updateMonitorUI(); 
                    break;
            }
        }

        function evaluate(str, ctx) {
            if(!str) return 0;
            // Variable replacement
            let parsed = str.replace(/\$(\w+)/g, (_,v) => (ctx.vars[v] !== undefined ? ctx.vars[v] : 0));
            
            // Random function support: random(1, 10)
            parsed = parsed.replace(/random\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g, (match, min, max) => {
                return Math.floor(Math.random() * (Number(max) - Number(min) + 1)) + Number(min);
            });

            try {
                if(/[^0-9+\-*/(). <>=!&|]/.test(parsed)) return parsed; 
                return Function('"use strict";return ('+parsed+')')();
            } catch { return parsed; }
        }

        function saveProject() {
            // Atualiza os atributos para salvar o estado atual
            document.querySelectorAll('#script-zone input, #script-zone select').forEach(el => {
                if(el.tagName === 'INPUT') el.setAttribute('value', el.value);
                if(el.tagName === 'SELECT') {
                    for(let i=0; i<el.options.length; i++) {
                        if(el.options[i].value === el.value) el.options[i].setAttribute('selected', 'selected');
                        else el.options[i].removeAttribute('selected');
                    }
                }
            });
            const data = {
                scriptZone: document.getElementById('script-zone').innerHTML,
                spriteState: spriteState,
                knownVars: knownVars,
                globalVars: globalVars
            };
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'}));
            a.download = 'projeto.json';
            a.click();
        }

        function loadProject(event) {
            const file = event.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if(data.knownVars) knownVars = data.knownVars;
                    if(data.globalVars) globalVars = data.globalVars;
                    
                    updateVarSelects();
                    updateMonitorUI();

                    if(data.scriptZone) {
                        document.getElementById('script-zone').innerHTML = sanitizeHTML(data.scriptZone);
                        // Reaplicar eventos de drag n drop aos blocos carregados
                        document.querySelectorAll('#script-zone .block, #script-zone .block-c-wrap').forEach(el => {
                            setupBlockEvents(el);
                        });
                        // Re-habilitar inputs dos blocos no workspace
                        document.querySelectorAll('#script-zone input, #script-zone select').forEach(el => {
                            el.removeAttribute('disabled');
                            el.style.pointerEvents = 'auto';
                        });
                    }
                    if(data.spriteState) {
                        spriteState = data.spriteState;
                        updateSpriteVisuals();
                    }
                } catch(err) {
                    customAlert('Erro ao carregar o projeto.');
                }
                // Reset file input so it can trigger change again for same file
                event.target.value = '';
            };
            reader.readAsText(file);
        }

        async function clearWorkspace() {
            if(await customConfirm("Tem certeza que deseja limpar tudo? O progresso não salvo será perdido.")) {
                document.getElementById('script-zone').innerHTML = '<div class="absolute top-20 left-10 p-6 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center gap-2 text-slate-400 select-none pointer-events-none" id="start-hint"><span class="material-symbols-rounded text-4xl text-green-400">flag</span><p class="text-xs font-bold">Arraste a bandeira aqui</p></div>';
                spriteState = {x:0, y:0, dir:90, size:100, color: 'transparent'};
                updateSpriteVisuals();
                saveToLocalStorage();
            }
        }
        
        function scrollToCat(id) { document.getElementById(id).scrollIntoView({behavior:'smooth'}); }

        init();

        // --- Persistence ---
        function saveToLocalStorage() {
            // Update input attributes first
            document.querySelectorAll('#script-zone input, #script-zone select').forEach(el => {
                if(el.tagName === 'INPUT') {
                    if (el.getAttribute('value') !== el.value) el.setAttribute('value', el.value);
                }
                if(el.tagName === 'SELECT') {
                    for(let i=0; i<el.options.length; i++) {
                        if(el.options[i].value === el.value) {
                            if (!el.options[i].hasAttribute('selected')) el.options[i].setAttribute('selected', 'selected');
                        } else {
                            if (el.options[i].hasAttribute('selected')) el.options[i].removeAttribute('selected');
                        }
                    }
                }
            });
            const data = {
                scriptZone: document.getElementById('script-zone').innerHTML,
                spriteState: spriteState,
                knownVars: knownVars,
                globalVars: globalVars
            };
            localStorage.setItem('visualLogicSave', JSON.stringify(data));
        }

        function loadFromLocalStorage() {
            const saved = localStorage.getItem('visualLogicSave');
            if(saved) {
                try {
                    const data = JSON.parse(saved);
                    if(data.knownVars) knownVars = data.knownVars;
                    if(data.globalVars) globalVars = data.globalVars;
                    
                    updateVarSelects();
                    updateMonitorUI();

                    if(data.scriptZone) {
                        document.getElementById('script-zone').innerHTML = sanitizeHTML(data.scriptZone);
                        document.querySelectorAll('#script-zone .block, #script-zone .block-c-wrap').forEach(el => {
                            setupBlockEvents(el);
                        });
                        document.querySelectorAll('#script-zone input, #script-zone select').forEach(el => {
                            el.removeAttribute('disabled');
                            el.style.pointerEvents = 'auto';
                        });
                    }
                    if(data.spriteState) {
                        spriteState = data.spriteState;
                        updateSpriteVisuals();
                    }
                } catch(e) {
                    console.error('Failed to parse local storage', e);
                }
            }
        }

        // Setup MutationObserver to save on DOM changes inside script-zone
        const workspaceObserver = new MutationObserver(() => {
            saveToLocalStorage();
        });
        window.addEventListener('load', () => {
            loadFromLocalStorage();
            workspaceObserver.observe(document.getElementById('script-zone'), { childList: true, subtree: true, attributes: true, characterData: true });
        });



// --- Stage Zoom ---
let currentStageZoom = 1.0;

function changeStageZoom(amount) {
    currentStageZoom += amount;
    if(currentStageZoom < 0.25) currentStageZoom = 0.25;
    if(currentStageZoom > 3.0) currentStageZoom = 3.0;
    applyStageZoom();
}

function resetStageZoom() {
    currentStageZoom = 1.0;
    applyStageZoom();
}

function applyStageZoom() {
    const stageInner = document.getElementById('stage-inner');
    if(stageInner) {
        stageInner.style.transform = `scale(${currentStageZoom})`;
    }
}

// Listen to input changes in script-zone for autosave
document.getElementById('script-zone').addEventListener('change', () => {
    saveToLocalStorage();
});

// --- UI Modals (Overrides alert, confirm, prompt) ---
window.customAlert = function(msg) {
    return new Promise(resolve => {
        showModal('Aviso', msg, 'info', false, null, resolve);
    });
};

window.customConfirm = function(msg) {
    return new Promise(resolve => {
        showModal('Confirmação', msg, 'help', true, null, resolve);
    });
};

window.customPrompt = function(msg, defaultText='') {
    return new Promise(resolve => {
        const inputHtml = `<input type="text" id="modal-input" class="w-full mt-2 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-400 outline-none" value="${defaultText}">`;
        showModal('Entrada', msg + inputHtml, 'edit', true, () => {
            const val = document.getElementById('modal-input').value;
            resolve(val);
        }, () => resolve(null));
        // Focus
        setTimeout(() => {
            const inp = document.getElementById('modal-input');
            if(inp) { inp.focus(); inp.select(); }
        }, 50);
    });
};

function showModal(title, bodyHtml, icon, showCancel, onOk, onCancel) {
    const modal = document.getElementById('global-modal');
    const content = document.getElementById('modal-content');
    
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-icon').innerText = icon;
    
    const btnOk = document.getElementById('modal-btn-ok');
    const btnCancel = document.getElementById('modal-btn-cancel');
    
    btnCancel.style.display = showCancel ? 'block' : 'none';
    
    const cleanup = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.add('scale-95');
        btnOk.onclick = null;
        btnCancel.onclick = null;
    };
    
    btnOk.onclick = () => {
        cleanup();
        if(onOk) onOk();
        else if(onCancel) onCancel(true); // For alert/confirm resolve
    };
    
    btnCancel.onclick = () => {
        cleanup();
        if(onCancel) onCancel(showCancel ? false : null);
    };
    
    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
}

// Override native
window.alert = window.customAlert;
// Note: Native prompt and confirm are synchronous, our modal is async.
// We need to update the places where prompt and confirm were used to be async.

// --- Basic HTML Sanitizer ---
function sanitizeHTML(htmlStr) {
    const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
    const elements = doc.body.querySelectorAll('*');
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.tagName === 'SCRIPT' || el.tagName === 'IFRAME' || el.tagName === 'OBJECT') {
            el.remove();
            continue;
        }
        for (let j = el.attributes.length - 1; j >= 0; j--) {
            const attr = el.attributes[j];
            if (attr.name.toLowerCase().startsWith('on') || attr.value.toLowerCase().includes('javascript:')) {
                el.removeAttribute(attr.name);
            }
        }
    }
    return doc.body.innerHTML;
}
