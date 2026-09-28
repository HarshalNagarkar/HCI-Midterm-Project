// MSRTC Commute - Main Application Logic
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const screens = document.querySelectorAll('.screen');
    const navItems = document.querySelectorAll('.nav-item');
    const navTabTriggers = document.querySelectorAll('.nav-tab-trigger');
    const refreshBtn = document.getElementById('refresh-btn');
    const backBtns = document.querySelectorAll('.back-btn');
    const toastMessage = document.getElementById('toast-message');
    const statusClock = document.getElementById('status-clock');
    const navAlertsBadge = document.getElementById('nav-alerts-badge');

    let unseenAlerts = 3;
    let lastAlertCount = 3;
    let toastTimeout = null;

    // --- Status Bar Real-time Clock ---
    function updateClock() {
        const now = new Date();
        const hours = now.getHours();
        const mins = String(now.getMinutes()).padStart(2, '0');
        if (statusClock) {
            statusClock.textContent = `${hours % 12 || 12}:${mins}`;
        }
    }
    updateClock();
    setInterval(updateClock, 30000);

    // --- Toast Notifications ---
    function showToast(msg) {
        if (!toastMessage) return;
        toastMessage.textContent = msg;
        toastMessage.classList.remove('hidden');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toastMessage.classList.add('hidden');
        }, 2200);
    }

    // --- Screen Navigation Logic ---
    function showScreen(screenId) {
        screens.forEach(s => s.classList.remove('active'));
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            targetScreen.querySelector('.content-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        // Update Bottom Nav active state
        navItems.forEach(item => {
            if (item.getAttribute('data-target') === screenId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Mark alerts as viewed
        if (screenId === 'screen-alerts' && navAlertsBadge) {
            navAlertsBadge.classList.add('hidden');
            unseenAlerts = 0;
        }
    }

    // Nav bar listeners
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            if (target) showScreen(target);
        });
    });

    // Grid 2x2 cards on Home
    navTabTriggers.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            if (target) showScreen(target);
        });
    });

    // Sub-screens (Will you catch train, Full bus status)
    document.getElementById('btn-train')?.addEventListener('click', () => {
        showScreen('screen-train');
        navItems.forEach(item => item.classList.remove('active'));
    });

    document.getElementById('btn-status-full')?.addEventListener('click', () => {
        showScreen('screen-details');
        navItems.forEach(item => item.classList.remove('active'));
    });
    
    // Back buttons
    backBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            showScreen('screen-home');
        });
    });

    // --- Refresh Button ---
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            const svg = refreshBtn.querySelector('svg');
            if (svg) {
                svg.style.transition = "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
                svg.style.transform = "rotate(360deg)";
                setTimeout(() => {
                    svg.style.transition = "none";
                    svg.style.transform = "rotate(0deg)";
                }, 600);
            }

            if (window.BusSimulation) {
                window.BusSimulation.state.lastUpdated = new Date();
                window.BusSimulation.notifyListeners();
            }
            showToast('Live telemetry refreshed');
        });
    }

    // --- Live "Updated Xs ago" Counter ---
    function updateLiveTimeCounter() {
        if (!window.BusSimulation) return;
        
        const diffSecs = Math.max(0, Math.floor((new Date() - window.BusSimulation.state.lastUpdated) / 1000));
        let text = 'Just now';
        if (diffSecs >= 4 && diffSecs < 60) {
            text = `${diffSecs}s ago`;
        } else if (diffSecs >= 60) {
            text = `${Math.floor(diffSecs / 60)}m ago`;
        }

        const updatedEl = document.getElementById('home-last-updated');
        if (updatedEl) updatedEl.textContent = text;
        
        const returnUpdatedEl = document.getElementById('return-last-updated');
        if (returnUpdatedEl) returnUpdatedEl.textContent = text;
    }
    setInterval(updateLiveTimeCounter, 1000);

    // ==========================================================================
    // State Subscriptions & UI Updates
    // ==========================================================================
    let currentRouteMode = 'forward';

    if (window.BusSimulation) {
        window.BusSimulation.subscribe((state, returnState) => {
            updateHome(state);
            updateDetails(state);
            updateTrainConnection(state);
            updateRoutes(state, returnState);
            updateAlerts(state);
        });
    }

    // Toggle button logic
    const btnRouteForward = document.getElementById('btn-route-forward');
    const btnRouteReturn = document.getElementById('btn-route-return');

    if (btnRouteForward && btnRouteReturn) {
        btnRouteForward.addEventListener('click', () => {
            currentRouteMode = 'forward';
            btnRouteForward.classList.add('active');
            btnRouteReturn.classList.remove('active');
            if (window.BusSimulation) {
                updateRoutes(window.BusSimulation.state, window.BusSimulation.returnState);
                updateHome(window.BusSimulation.state);
            }
        });

        btnRouteReturn.addEventListener('click', () => {
            currentRouteMode = 'return';
            btnRouteReturn.classList.add('active');
            btnRouteForward.classList.remove('active');
            if (window.BusSimulation) {
                updateRoutes(window.BusSimulation.state, window.BusSimulation.returnState);
                updateHome(window.BusSimulation.state);
            }
        });
    }

    // 1. Update Home Screen
    function updateHome(state) {
        const activeState = currentRouteMode === 'forward' ? state : window.BusSimulation.returnState;
        
        const statusEl = document.getElementById('home-bus-status');
        const pillText = document.getElementById('home-pill-text');
        const statusPill = document.getElementById('home-status-pill');
        const locText = document.getElementById('home-location-text');
        const etaVal = document.getElementById('home-eta-val');
        const etaUnit = document.getElementById('home-eta-unit');
        const progressFill = document.getElementById('home-progress-fill');
        const trainBadge = document.getElementById('home-train-badge');
        const islandText = document.getElementById('island-transit-text');
        const routeDirection = document.querySelector('.route-direction');

        if (!statusEl || !statusPill || !activeState) return;

        // Reset class states
        statusEl.className = 'huge-status';
        statusPill.className = 'status-pill';
        
        if (routeDirection) {
            routeDirection.textContent = currentRouteMode === 'forward' ? 'College → Station' : 'Station → College';
        }

        if (activeState.status === 'on_time') {
            statusEl.textContent = 'On Time';
            statusEl.classList.add('text-green');
            pillText.textContent = 'On Time';
            statusPill.classList.add('status-green');
            if (islandText) islandText.textContent = 'MSRTC • On Time';
        } else if (activeState.status === 'delayed') {
            statusEl.textContent = `Delayed ${activeState.delayMinutes} min`;
            statusEl.classList.add('text-red');
            pillText.textContent = 'Delayed';
            statusPill.classList.add('status-red');
            if (islandText) islandText.textContent = `MSRTC • +${activeState.delayMinutes}m`;
        } else {
            statusEl.textContent = 'Unavailable';
            statusEl.classList.add('text-amber');
            pillText.textContent = 'Offline';
            statusPill.classList.add('status-amber');
            if (islandText) islandText.textContent = 'MSRTC • Offline';
        }

        const currentStop = window.BusSimulation.STOPS[activeState.currentStopIndex];
        locText.textContent = `Waiting at ${currentStop}`;

        // ETA calculation
        if (currentRouteMode === 'forward') {
            const etaDate = window.BusSimulation.getBusETAAtStation();
            if (etaDate) {
                const mins = Math.max(0, Math.round((etaDate - new Date()) / 60000));
                etaVal.textContent = mins;
                etaUnit.textContent = mins === 1 ? 'min' : 'mins';
            } else {
                etaVal.textContent = 'Arrived';
                etaUnit.textContent = '';
            }

            // Hero route progress calculation
            const totalStops = window.BusSimulation.STOPS.length - 1;
            const rawProgress = (activeState.currentStopIndex + activeState.progressBetweenStops) / totalStops;
            const progressPercent = Math.min(100, Math.max(5, Math.round(rawProgress * 100)));
            if (progressFill) {
                progressFill.style.width = `${progressPercent}%`;
            }

            if (document.getElementById('btn-train')) {
                document.getElementById('btn-train').style.display = 'flex';
            }

            // Quick train verdict badge on Home
            if (trainBadge && etaDate) {
                const now = new Date();
                const etaMins = Math.round((etaDate - now) / 60000);
                const trainDep = window.BusSimulation.getTrainDepartureTime();
                const depMins = Math.round((trainDep - now) / 60000);
                const diff = depMins - etaMins;

                trainBadge.className = 'chip-verdict';
                if (diff >= 10) {
                    trainBadge.classList.add('verdict-yes');
                    trainBadge.textContent = 'Yes';
                } else if (diff >= 0) {
                    trainBadge.classList.add('verdict-risk');
                    trainBadge.textContent = 'At Risk';
                } else {
                    trainBadge.classList.add('verdict-no');
                    trainBadge.textContent = 'No';
                }
            }
        } else {
            // Return Mode calculations
            const etaMinutes = (activeState.currentStopIndex * 5) + (activeState.status === 'delayed' ? activeState.delayMinutes : 0);
            if (activeState.currentStopIndex > 0) {
                etaVal.textContent = Math.max(1, Math.round(etaMinutes - (activeState.progressBetweenStops * 5)));
                etaUnit.textContent = 'min';
            } else {
                etaVal.textContent = 'Arrived';
                etaUnit.textContent = '';
            }

            const totalStops = window.BusSimulation.STOPS.length - 1;
            const rawProgress = (totalStops - activeState.currentStopIndex + activeState.progressBetweenStops) / totalStops;
            const progressPercent = Math.min(100, Math.max(5, Math.round(rawProgress * 100)));
            if (progressFill) {
                progressFill.style.width = `${progressPercent}%`;
            }

            // Hide train connection card for return route since they are leaving the station
            if (document.getElementById('btn-train')) {
                document.getElementById('btn-train').style.display = 'none';
            }
        }
    }


    // 2. Update Train Connection Sub-screen
    function updateTrainConnection(state) {
        const verdictCard = document.getElementById('train-verdict-card');
        const verdictText = document.getElementById('train-verdict-text');
        const verdictDesc = document.getElementById('train-verdict-desc');
        const progressBar = document.getElementById('train-progress-bar');
        const marginText = document.getElementById('train-margin-text');
        const tipText = document.getElementById('train-tip-text');
        
        const whyStatus = document.getElementById('train-why-status');
        const whyEta = document.getElementById('train-why-eta');
        const whyDep = document.getElementById('train-why-dep');
        const whyMargin = document.getElementById('train-why-margin');

        if (!verdictCard || !verdictText) return;

        const busEta = window.BusSimulation.getBusETAAtStation();
        const trainDep = window.BusSimulation.getTrainDepartureTime();
        const now = new Date();

        const etaMins = busEta ? Math.max(0, Math.round((busEta - now) / 60000)) : 0;
        const depMins = Math.max(1, Math.round((trainDep - now) / 60000));
        const diffMins = depMins - etaMins;

        // Breakdown stats
        if (whyStatus) {
            whyStatus.textContent = state.status === 'delayed' 
                ? `Delayed ${state.delayMinutes} min` 
                : (state.status === 'on_time' ? 'On schedule' : 'Unavailable');
        }
        if (whyEta) whyEta.textContent = busEta ? `${etaMins} min (${window.BusSimulation.formatTime(busEta)})` : 'Arrived at Station';
        if (whyDep) whyDep.textContent = `${depMins} min (${window.BusSimulation.formatTime(trainDep)} • Platform 3)`;
        
        if (whyMargin) {
            whyMargin.className = 'breakdown-val';
            if (diffMins >= 10) {
                whyMargin.textContent = `+${diffMins} min (Safe)`;
                whyMargin.classList.add('text-green');
            } else if (diffMins >= 0) {
                whyMargin.textContent = `+${diffMins} min (Tight)`;
                whyMargin.classList.add('text-amber');
            } else {
                whyMargin.textContent = `${diffMins} min (Missed)`;
                whyMargin.classList.add('text-red');
            }
        }

        verdictCard.className = 'large-card verdict-card text-center mt-3';

        if (diffMins >= 10) {
            verdictCard.classList.add('verdict-yes');
            verdictText.textContent = 'Yes';
            verdictText.style.color = 'var(--color-green)';
            verdictDesc.textContent = 'You have plenty of time. Safe connection expected at Karjat Station.';
            marginText.textContent = `+${diffMins} min buffer`;
            progressBar.style.backgroundColor = 'var(--color-green)';
            progressBar.style.width = '100%';
            if (tipText) tipText.textContent = 'Proceed normally to Platform 3 upon arrival at Karjat Station.';
        } else if (diffMins >= 0) {
            verdictCard.classList.add('verdict-risk');
            verdictText.textContent = 'At Risk';
            verdictText.style.color = 'var(--color-amber)';
            verdictDesc.textContent = 'Tight connection. You might make it if you transfer briskly to Platform 3.';
            marginText.textContent = `${diffMins} min margin`;
            progressBar.style.backgroundColor = 'var(--color-amber)';
            progressBar.style.width = '60%';
            if (tipText) tipText.textContent = 'Keep your ticket ready and proceed directly to foot-over-bridge towards Platform 3.';
        } else {
            verdictCard.classList.add('verdict-no');
            verdictText.textContent = 'No';
            verdictText.style.color = 'var(--color-red)';
            verdictDesc.textContent = "You'll likely miss this train due to road delays. An alternate train is available shortly after.";
            marginText.textContent = `${Math.abs(diffMins)} min short`;
            progressBar.style.backgroundColor = 'var(--color-red)';
            progressBar.style.width = '25%';
            if (tipText) tipText.textContent = 'Recommended: Take the next CSMT Slow Local departing 20 mins later from Platform 2.';
        }
    }

    // 3. Update Full Bus Status Screen
    function updateDetails(state) {
        const textEl = document.getElementById('details-status-text');
        const reasonEl = document.getElementById('details-delay-reason');
        const locEl = document.getElementById('details-location');
        const arrEl = document.getElementById('details-arrival-time');
        const speedEl = document.getElementById('details-speed');
        const occEl = document.getElementById('details-occupancy');
        const badgePill = document.getElementById('details-badge-pill');
        const cardEl = document.getElementById('details-status-card');

        if (!textEl) return;

        if (state.status === 'on_time') {
            textEl.textContent = 'On Time';
            textEl.style.color = 'var(--color-green)';
            if (cardEl) cardEl.style.borderLeftColor = 'var(--color-green)';
            if (badgePill) {
                badgePill.textContent = 'On Time';
                badgePill.style.background = 'var(--color-green-bg)';
                badgePill.style.color = 'var(--color-green-text)';
            }
            reasonEl.textContent = 'Bus is operating smoothly according to scheduled timetable.';
        } else if (state.status === 'delayed') {
            textEl.textContent = `Delayed ${state.delayMinutes} min`;
            textEl.style.color = 'var(--color-red)';
            if (cardEl) cardEl.style.borderLeftColor = 'var(--color-red)';
            if (badgePill) {
                badgePill.textContent = 'Delayed';
                badgePill.style.background = 'var(--color-red-bg)';
                badgePill.style.color = 'var(--color-red-text)';
            }
            reasonEl.textContent = state.delayReason || 'Congestion and road repairs reported on route.';
        } else {
            textEl.textContent = 'Telemetry Offline';
            textEl.style.color = 'var(--color-amber)';
            if (cardEl) cardEl.style.borderLeftColor = 'var(--color-amber)';
            if (badgePill) {
                badgePill.textContent = 'Offline';
                badgePill.style.background = 'var(--color-amber-bg)';
                badgePill.style.color = 'var(--color-amber-text)';
            }
            reasonEl.textContent = 'GPS connection momentarily searching for signal.';
        }

        const currentStopName = window.BusSimulation.STOPS[state.currentStopIndex];
        if (locEl) locEl.textContent = currentStopName;
        
        const eta = window.BusSimulation.getBusETAAtStation();
        if (arrEl) arrEl.textContent = eta ? window.BusSimulation.formatTime(eta) : 'Arrived';
        
        if (speedEl) speedEl.textContent = `${state.currentSpeed} km/h`;
        if (occEl) occEl.textContent = state.occupancy;
    }

    // 4. Update Routes & Stops List
    function updateRoutes(state, returnState) {
        const list = document.getElementById('stops-list');
        if (!list) return;

        const searchTerm = (document.getElementById('stop-search')?.value || '').trim().toLowerCase();
        list.innerHTML = '';

        if (currentRouteMode === 'forward') {
            window.BusSimulation.STOPS.forEach((stop, index) => {
                if (searchTerm && !stop.toLowerCase().includes(searchTerm)) return;

                const li = document.createElement('li');
                let subtext = '';
                let etaText = '';

                if (index < state.currentStopIndex) {
                    li.className = 'passed';
                    subtext = 'Departed';
                    etaText = 'Passed';
                } else if (index === state.currentStopIndex) {
                    li.className = 'current';
                    subtext = 'Bus is here now';
                    etaText = 'Now';
                } else {
                    li.className = 'upcoming';
                    const stopsAway = index - state.currentStopIndex;
                    etaText = window.BusSimulation.getETAForStop(index);
                    subtext = `${stopsAway} ${stopsAway === 1 ? 'stop' : 'stops'} away`;
                }

                li.innerHTML = `
                    <div class="stop-info">
                        <span class="stop-name">${stop}</span>
                        <span class="stop-sub">${subtext}</span>
                    </div>
                    <span class="stop-eta-badge">${etaText}</span>
                `;
                list.appendChild(li);
            });
        } else {
            // Return Mode
            if (!returnState) return;
            const returnStops = [...window.BusSimulation.STOPS].reverse();
            const currentReturnIndex = window.BusSimulation.STOPS.length - 1 - returnState.currentStopIndex;

            returnStops.forEach((stop, index) => {
                if (searchTerm && !stop.toLowerCase().includes(searchTerm)) return;

                const li = document.createElement('li');
                let subtext = '';
                let etaText = '';

                if (index < currentReturnIndex) {
                    li.className = 'passed';
                    subtext = 'Departed';
                    etaText = 'Passed';
                } else if (index === currentReturnIndex) {
                    li.className = 'current';
                    subtext = 'Bus is here now';
                    etaText = 'Now';
                } else {
                    li.className = 'upcoming';
                    const stopsAway = index - currentReturnIndex;
                    let mins = (stopsAway * 5) + (returnState.status === 'delayed' ? Math.round(returnState.delayMinutes * 0.5) : 0);
                    mins -= Math.round(returnState.progressBetweenStops * 5);
                    mins = Math.max(1, mins);
                    
                    etaText = `${mins} min`;
                    subtext = `${stopsAway} ${stopsAway === 1 ? 'stop' : 'stops'} away`;
                }

                li.innerHTML = `
                    <div class="stop-info">
                        <span class="stop-name">${stop}</span>
                        <span class="stop-sub">${subtext}</span>
                    </div>
                    <span class="stop-eta-badge">${etaText}</span>
                `;
                list.appendChild(li);
            });
        }
    }

    // Stop Search filter
    const stopSearchInput = document.getElementById('stop-search');
    const clearSearchBtn = document.getElementById('clear-search');
    if (stopSearchInput) {
        stopSearchInput.addEventListener('input', (e) => {
            if (clearSearchBtn) {
                clearSearchBtn.classList.toggle('hidden', !e.target.value);
            }
            if (window.BusSimulation) {
                updateRoutes(window.BusSimulation.state);
            }
        });
    }
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            stopSearchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            if (window.BusSimulation) {
                updateRoutes(window.BusSimulation.state);
            }
        });
    }

    // 5. Update Alerts List
    function updateAlerts(state) {
        const container = document.getElementById('alerts-list');
        if (!container) return;

        container.innerHTML = '';

        state.alerts.forEach(alert => {
            const card = document.createElement('div');
            card.className = 'alert-card';

            const iconSvg = alert.type === 'delay'
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
                : (alert.type === 'weather'
                    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>`
                    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`);

            card.innerHTML = `
                <div class="alert-icon ${alert.type}">${iconSvg}</div>
                <div class="alert-body">
                    <h4>${alert.title || (alert.type === 'delay' ? 'Delay Bulletin' : 'Information')}</h4>
                    <p>${alert.message}</p>
                    <span class="alert-time">${window.BusSimulation.formatTime(alert.time)}</span>
                </div>
            `;
            container.appendChild(card);
        });

        // Unread badge counter
        if (state.alerts.length > lastAlertCount) {
            unseenAlerts += (state.alerts.length - lastAlertCount);
            if (navAlertsBadge && !document.getElementById('screen-alerts')?.classList.contains('active')) {
                navAlertsBadge.textContent = unseenAlerts;
                navAlertsBadge.classList.remove('hidden');
            }
        }
        lastAlertCount = state.alerts.length;
    }

    // Mark alerts as read button
    document.getElementById('btn-mark-alerts-read')?.addEventListener('click', () => {
        unseenAlerts = 0;
        if (navAlertsBadge) navAlertsBadge.classList.add('hidden');
        showToast('All alerts marked as read');
    });

    // ==========================================================================
    // Journey Planning Tab Logic
    // ==========================================================================
    const planFrom = document.getElementById('plan-from');
    const planTo = document.getElementById('plan-to');
    const btnSwapStops = document.getElementById('btn-swap-stops');
    const btnCalculatePlan = document.getElementById('btn-calculate-plan');
    const suggestedRoute = document.getElementById('suggested-route');
    
    if (planFrom && planTo && window.BusSimulation) {
        window.BusSimulation.STOPS.forEach(stop => {
            const opt1 = document.createElement('option');
            opt1.value = stop;
            opt1.textContent = stop;
            planFrom.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = stop;
            opt2.textContent = stop;
            planTo.appendChild(opt2);
        });

        planFrom.value = window.BusSimulation.STOPS[0];
        planTo.value = window.BusSimulation.STOPS[window.BusSimulation.STOPS.length - 2]; // Karjat Station
    }

    if (btnSwapStops && planFrom && planTo) {
        btnSwapStops.addEventListener('click', () => {
            const temp = planFrom.value;
            planFrom.value = planTo.value;
            planTo.value = temp;
        });
    }

    if (btnCalculatePlan && planFrom && planTo) {
        btnCalculatePlan.addEventListener('click', () => {
            const fromStop = planFrom.value;
            const toStop = planTo.value;
            const fromIdx = window.BusSimulation.STOPS.indexOf(fromStop);
            const toIdx = window.BusSimulation.STOPS.indexOf(toStop);

            if (fromIdx === toIdx) {
                showToast('Please select a different destination');
                return;
            }

            const travelMins = window.BusSimulation.getTravelTime(fromStop, toStop);
            const depTime = new Date();
            depTime.setMinutes(depTime.getMinutes() + 4);
            const arrTime = new Date(depTime);
            arrTime.setMinutes(arrTime.getMinutes() + travelMins);

            const stopCount = Math.abs(toIdx - fromIdx);
            const direction = toIdx > fromIdx ? 'forward' : 'reverse';

            const timeEl = document.getElementById('plan-route-time');
            const durationEl = document.getElementById('plan-route-duration');
            const descEl = document.getElementById('plan-route-desc');
            const stepBoard = document.getElementById('plan-step-board');
            const stepAlight = document.getElementById('plan-step-alight');

            if (timeEl) timeEl.textContent = `${window.BusSimulation.formatTime(depTime)} → ${window.BusSimulation.formatTime(arrTime)}`;
            if (durationEl) durationEl.textContent = `${travelMins} mins`;
            if (descEl) descEl.textContent = `Direct MSRTC ${direction === 'reverse' ? 'return' : ''} bus. Covers ${stopCount} stop${stopCount > 1 ? 's' : ''} with guaranteed seat availability.`;
            if (stepBoard) stepBoard.textContent = `Board at ${fromStop}`;
            if (stepAlight) stepAlight.textContent = `Alight at ${toStop}`;

            if (suggestedRoute) {
                suggestedRoute.classList.remove('hidden');
                suggestedRoute.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    // ==========================================================================
    // Accordion & FAQ Logic
    // ==========================================================================
    document.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', function() {
            const item = this.parentElement;
            const isOpen = item.classList.contains('open');
            // Close other items
            document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));
            if (!isOpen) {
                item.classList.add('open');
            }
        });
    });

    // ==========================================================================
    // Feedback Form Submission
    // ==========================================================================
    const feedbackForm = document.getElementById('feedback-form');
    const feedbackSuccess = document.getElementById('feedback-success');

    if (feedbackForm && feedbackSuccess) {
        feedbackForm.addEventListener('submit', (e) => {
            e.preventDefault();
            feedbackForm.style.display = 'none';
            feedbackSuccess.classList.remove('hidden');

            setTimeout(() => {
                feedbackSuccess.classList.add('hidden');
                feedbackForm.style.display = 'block';
                feedbackForm.reset();
            }, 3500);
        });
    }

    // Exhibition Demo Controls (Inside app screen)
    document.getElementById('btn-demo-delay')?.addEventListener('click', () => {
        window.BusSimulation.triggerDelay(14, 'Heavy traffic congestion reported near Solanpada junction.');
    });

    document.getElementById('btn-demo-ontime')?.addEventListener('click', () => {
        window.BusSimulation.resolveDelay();
    });

    document.getElementById('btn-demo-advance')?.addEventListener('click', () => {
        window.BusSimulation.advanceStop();
    });

    // Start Simulation Background Loop
    window.BusSimulation.startSimulation();
});




