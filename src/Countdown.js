import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { db } from './firebase';  // Firestore config
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";  // Firestore functions

function Countdown() {
  const { gameCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const playerName = location.state?.playerName || '';
  const [isCreator, setIsCreator] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [role, setRole] = useState('');
  const [tasks, setTasks] = useState([]);  // Crewmate's tasks
  const [completedTasks, setCompletedTasks] = useState([]);  // Completed tasks
  const [killList, setKillList] = useState([]);  // Imposter's kill list
  const [crewmates, setCrewmates] = useState([]);
  const [isDead, setIsDead] = useState(false);
  const [totalTasks, setTotalTasks] = useState(100);
  const [totalCompletedTasks, setTotalCompletedTasks] = useState(0);
  const [killCooldown, setKillCooldown] = useState(0);
  const [cooldownTimer, setCooldownTimer] = useState(0);
  const [fellowImposters, setFellowImposters] = useState([]); // Fellow imposters
  const [isSabotageDialogOpen, setIsSabotageDialogOpen] = useState(false);
  const [sabotageCooldown, setSabotageCooldown] = useState(0);
  const [tasksBlocked, setTasksBlocked] = useState(false);
  const [sabotagingImposter, setSabotagingImposter] = useState('')
  const [sabotageActive, setSabotageActive] = useState(false);
  const [sabotagedPlayer, setSabotagedPlayer] = useState('');

  useEffect(() => {
    if (countdown === 0) {
      const gameRef = doc(db, "games", gameCode);
      getDoc(gameRef).then((docSnapshot) => {
        if (docSnapshot.exists()) {
          const gameData = docSnapshot.data();
          const roles = gameData.roles || {}; // Default to an empty object if roles is undefined
          const playerRole = roles[playerName];
          setRole(playerRole);
          setIsCreator(gameData.creator === playerName);
          setIsDead(gameData.killList?.includes(playerName));
          setKillCooldown(gameData.killCooldown || 30); // Load kill cooldown
  
          // If player is a crewmate, load their assigned tasks
          if (playerRole === 'Crewmate') {
            setTasks(gameData.assignedTasks[playerName] || []);
            setCompletedTasks(gameData.completedTasks?.[playerName] || []);
          }

          // Snippet 2: Imposter logic
          if (playerRole === 'Imposter') {
            setKillList(gameData.killList || []);  // Set kill list for imposters
            const crewmatesList = Object.keys(roles).filter(player => roles[player] === 'Crewmate').sort();
            setCrewmates(crewmatesList);  // Set the list of crewmates for imposters

            const impostersList = Object.keys(roles)
              .filter(player => roles[player] === 'Imposter' && player !== playerName)
              .sort();
            setFellowImposters(impostersList);
          }
        }
      });
    }
  }, [countdown, gameCode, playerName]);

  // Fetch creator and role as soon as the component mounts
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    getDoc(gameRef).then((docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
        setIsCreator(gameData.creator === playerName);  // Set if the player is the creator
        const roles = gameData.roles || {}; // Default to an empty object if roles is undefined
        setRole(roles[playerName]);  // Set the role of the player
      }
    });
  }, [gameCode, playerName]);

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
  
      const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const gameData = docSnapshot.data();
          setKillList(gameData.killList || []);  // Update kill list in real-time
          setIsDead(gameData.killList?.includes(playerName));
        }
      });
  
      return () => unsubscribe();  // Clean up listener on component unmount
  }, [role, gameCode]);

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
        
        // Check if an emergency meeting was called
        if (gameData.meetingCalled) {
          resetSabotage();
          // Navigate to the voting page for all players
          navigate(`/voting/${gameCode}`, { state: { playerName } });
        }
      }
    });
  
    return () => unsubscribe();  // Clean up the listener
  }, [gameCode, navigate, playerName]);

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
        const roles = gameData.roles || {}; // Default to an empty object if roles is undefined
        
        // Get all crewmates
        const crewmatesList = Object.keys(roles)
          .filter(player => roles[player] === 'Crewmate')
          .sort();  // Sort alphabetically by name
        setCrewmates(crewmatesList);
        
        // Calculate total assigned tasks for all crewmates
        const combinedTasks = crewmatesList.reduce((total, crewmate) => {
          return total + (gameData.assignedTasks?.[crewmate]?.length || 0);
        }, 0);
  
        // Calculate total completed tasks for all crewmates
        const completedTasks = crewmatesList.reduce((total, crewmate) => {
          return total + (gameData.completedTasks?.[crewmate]?.length || 0);
        }, 0);
  
        setTotalTasks(combinedTasks);
        setTotalCompletedTasks(completedTasks);
      }
    });
  
    return () => unsubscribe();  // Clean up listener on component unmount
  }, [gameCode]);
  


  // Countdown logic
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    if (countdown === 0) {
      clearInterval(timer);
    }

    return () => clearInterval(timer);  // Clean up the timer on component unmount
  }, [countdown]);

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
  
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
        const { sabotageActive, sabotagedPlayer, sabotageType, sabotagingImposter } = gameData;

        setSabotageActive(sabotageActive || false);
        setSabotagedPlayer(sabotagedPlayer || '');
  
        // Handle sabotage notification for the sabotaged player
        if (sabotageActive && sabotagedPlayer === playerName && sabotageType === 'FindMe') {
          console.log(`You have been sabotaged! Find the imposter to resume tasks.`);
          // Logic to block tasks for the sabotaged player
          setTasksBlocked(true);
          setSabotagingImposter(sabotagingImposter);
        } else {
          // Reset task block if sabotage is resolved
          setTasksBlocked(false);
          setSabotagingImposter('');
        }
      }
    });
  
    return () => unsubscribe(); // Clean up listener on component unmount
  }, [gameCode, playerName]);

  // Listener for game deletion
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (!docSnapshot.exists()) {
        console.log("Game deleted. Navigating to home...");
        navigate("/");
      }
    });

    return () => unsubscribe();  // Clean up the listener on component unmount
  }, [gameCode, navigate]);

  // Listener for game end
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const gameData = docSnapshot.data();
        const roles = gameData.roles || {}; // Default to an empty object if roles is undefined

        // If gameStarted is false, navigate everyone back to the lobby
        if (!gameData.gameStarted && !gameData.gameEnded) {
          console.log("Game round ended. Navigating back to lobby...");
          navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator, gameStarted: false } });
        }

        if (gameData.gameEnded) {
            const result = roles[playerName] === 'Crewmate' && gameData.completedTasks
              ? 'win'
              : 'lose';
    
            // Navigate all players to the Game Over screen
            navigate(`/gameover/${gameCode}`, { state: { playerName, result } });
          }
      }
    });

    return () => unsubscribe();  // Clean up the listener when the component unmounts
  }, [gameCode, navigate, playerName, isCreator]);

  const toggleCrewmateDeath = async (crewmate) => {
    if (killList.includes(crewmate)) {
      // If the crewmate is already in the kill list, remove them
      const updatedKillList = killList.filter((name) => name !== crewmate);
      setKillList(updatedKillList);
  
      // Reset cooldown timer if the current kill was untoggled
      if (cooldownTimer > 0) {
        setCooldownTimer(0);
      }
  
      // Update Firestore with the updated kill list
      const gameRef = doc(db, "games", gameCode);
      await updateDoc(gameRef, {
        killList: updatedKillList
      });
  
      return;
    }
  
    if (cooldownTimer > 0) {
      console.log("Kill cooldown active, cannot kill yet.");
      return;
    }
  
    // Add crewmate to kill list
    const updatedKillList = [...killList, crewmate];
    setKillList(updatedKillList);
  
    // Update Firestore with new kill list
    const gameRef = doc(db, "games", gameCode);
    await updateDoc(gameRef, {
      killList: updatedKillList
    });
  
    await checkIfAllKillsCompleted(updatedKillList);
  
    // Start cooldown timer
    setCooldownTimer(killCooldown);
  };

  useEffect(() => {
    if (sabotageCooldown > 0) {
      const timer = setInterval(() => {
        setSabotageCooldown((prev) => prev - 1);
      }, 1000);
  
      return () => clearInterval(timer);
    }
  }, [sabotageCooldown]);

  useEffect(() => {
    if (cooldownTimer > 0) {
      const timer = setInterval(() => {
        setCooldownTimer((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [cooldownTimer]);


  const checkIfAllKillsCompleted = async (updatedKillList) => {
    const gameRef = doc(db, "games", gameCode);
    const gameData = (await getDoc(gameRef)).data();
    const roles = gameData.roles || {};

    const aliveCrewmates = Object.keys(roles).filter(
      (player) => roles[player] === 'Crewmate' && !updatedKillList.includes(player)
    );
    const aliveImposters = Object.keys(roles).filter(
      (player) => roles[player] === 'Imposter' && !updatedKillList.includes(player)
    );

    if (aliveImposters.length >= aliveCrewmates.length) {
      // Navigate to the Game Over screen and pass lose state
      navigate(`/gameover/${gameCode}`, { state: { playerName, result: 'lose' } });
      await updateDoc(gameRef, { gameEnded: true });
    }
  };

  const toggleTaskCompletion = (task) => {
    if (tasksBlocked) {
      console.log("Tasks are blocked due to sabotage. Find the imposter to resume.");
      return;
    }

    const updatedCompletedTasks = completedTasks.includes(task)
      ? completedTasks.filter((t) => t !== task)
      : [...completedTasks, task];
  
    setCompletedTasks(updatedCompletedTasks);
  
    // Update completed tasks for the current player in Firestore
    const gameRef = doc(db, "games", gameCode);
    updateDoc(gameRef, {
      [`completedTasks.${playerName}`]: updatedCompletedTasks  // Store each crewmate's completed tasks
    });
  
    // Check if all crewmates have completed their tasks
    checkIfAllTasksCompleted();
  };

  const checkIfAllTasksCompleted = async () => {
    const gameRef = doc(db, "games", gameCode);
    const gameData = (await getDoc(gameRef)).data();
    const roles = gameData.roles || {}; // Default to an empty object if roles is undefined
    
    // Get all crewmates
    const crewmates = Object.keys(roles).filter((player) => roles[player] === 'Crewmate');
    
    // Check if all crewmates have completed all their assigned tasks
    const allTasksCompleted = crewmates.every((crewmate) => {
      const assignedTasks = gameData.assignedTasks[crewmate] || [];
      const completedTasks = gameData.completedTasks?.[crewmate] || [];
      
      // Ensure all assigned tasks are completed by this crewmate
      return assignedTasks.length === completedTasks.length;
    });
  
    // If all crewmates have completed their tasks, end the game
    if (allTasksCompleted) {
      // Mark game as ended in Firestore and navigate to the game over screen
      await updateDoc(gameRef, { gameEnded: true });
  
      // Navigate to the Game Over screen for all players
      navigate(`/gameover/${gameCode}`, { state: { playerName, result: 'win' } });
    }
  };
  
  const callEmergencyMeeting = async () => {
    const gameRef = doc(db, "games", gameCode);
    await updateDoc(gameRef, { meetingCalled: true, meetingCaller: playerName });
  };

  const initiateFindMeSabotage = async (crewmate) => {
    if (sabotageCooldown > 0) {
      alert("Sabotage cooldown active, cannot sabotage yet.");
      return;
    }
  
    const gameRef = doc(db, "games", gameCode);
    try {
      await updateDoc(gameRef, {
        sabotageActive: true,
        sabotagedPlayer: crewmate,
        sabotageType: 'FindMe',
        sabotagingImposter: playerName
      });
      console.log(`Crewmate ${crewmate} has been sabotaged.`);
    } catch (error) {
      console.error("Error initiating sabotage:", error);
    }
  
    setIsSabotageDialogOpen(false);
  };

  const resetSabotage = async () => {
    const gameRef = doc(db, "games", gameCode);
    try {
      await updateDoc(gameRef, {
        sabotageActive: false,
        sabotagedPlayer: null,
        sabotagingImposter: null
      });
      console.log("Sabotage reset due to emergency meeting.");
    } catch (error) {
      console.error("Error resetting sabotage:", error);
    }
  };
  
  const handleSabotageReset = async () => {
    resetSabotage();
    setSabotageCooldown(120);
  }

  // End the game round
  const endGameRound = async () => {
    const gameRef = doc(db, "games", gameCode);

    try {
      await updateDoc(gameRef, { gameStarted: false });
      console.log("Game round ended.");
    } catch (error) {
      console.error("Error ending game round:", error);
    }
  };

  return <div className="countdown-screen">
  <div className="background-overlay">
    {countdown > 0 ? (
      <div className="countdown">
        <h1 className="countdown-timer">Game starting in... {countdown}</h1>
      </div>
    ) : (
      <div className="game-content">
        <div className="player-info">
          <h2 className="player-name">{playerName}</h2>
        </div>

        <h2 className={`role-announcement ${role}`}>
              {isDead
                ? `You are a Dead ${role}`
                : role === 'Imposter'
                ? 'You are the Imposter!'
                : 'You are a Crewmate!'}
            </h2>

        {role === 'Crewmate' && !tasksBlocked && (
          <div>
            <h3>Your Tasks</h3>
            <div className="task-list">
            <ul>
              {tasks.map((task, index) => (
                <li 
                key={index} 
                className={`task-item ${completedTasks.includes(task) ? 'selected' : ''}`}
                onClick={() => toggleTaskCompletion(task)}
              >
                {task}
              </li>
              ))}
            </ul>
          </div>
        </div>
        )}

      {role === 'Crewmate' && tasksBlocked && (
          <div>
            <h3>You have been sabotaged</h3>
            <p>Find {sabotagingImposter} to resume your tasks!</p>
        </div>
        )}

        {role === 'Imposter' && !isDead && (
          <div>
            <h3>Kill List</h3>
            <div className="kill-list">
              <ul>
                {crewmates.map((crewmate, index) => (
                  <li 
                  key={index} 
                  className={`kill-item ${killList.includes(crewmate) ? 'selected' : ''}`} 
                  onClick={() => toggleCrewmateDeath(crewmate)}>
                  <label>{crewmate}</label>
                </li>
                ))}
              </ul>
            </div>
            {cooldownTimer > 0 && (
                  <div className="cooldown-timer">
                    Cooldown: {cooldownTimer}s
                  </div>
                )}
                {fellowImposters.length > 0 && (
                    <div className="fellow-imposters">
                      <p>Other Imposters: {fellowImposters.join(', ')}</p>
                    </div>
                  )}
            </div>
        )}

        {role === 'Imposter' && isDead && !sabotageActive && (
          <div>
            <button className="end-game-btn" onClick={() => setIsSabotageDialogOpen(true)}>
              Initiate Sabotage
            </button>
            {isSabotageDialogOpen && (
                <div className="dialog-overlay">
                  <div className="dialog">
                    <h3>Select a player to sabotage:</h3>
                    <ul>
                      {crewmates.map((crewmate, index) => (
                        <li className='kill-item' key={index} onClick={() => initiateFindMeSabotage(crewmate)}>
                          <label className="sabotage-option-btn">{crewmate}</label>
                        </li>
                      ))}
                    </ul>
                    <button className='end-game-btn' onClick={() => setIsSabotageDialogOpen(false)}>Cancel</button>
                  </div>
                </div>
              )}
              {sabotageCooldown > 0 && (
                <div className="sabotage-cooldown">
                  Sabotage Cooldown: {sabotageCooldown}s
                </div>
              )}
          </div>
        )}

        {role === 'Imposter' && isDead && sabotageActive && (
          <div>
            <p>Hide in one place and wait for {sabotagedPlayer} to find you. Once they do, press the button below.</p>
            <button className="reset-sabotage-btn" onClick={handleSabotageReset}>
              {sabotagedPlayer} Found Me
            </button>
          </div>
        )}

            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${(totalCompletedTasks / totalTasks) * 100}%` }}
              >
                {Math.round((totalCompletedTasks / totalTasks) * 100)}%
              </div>
            </div>

        <div className="buttons">
          {role && !isDead && !tasksBlocked && (
            <button className="emergency-meeting-btn" onClick={callEmergencyMeeting} disabled={isDead}>
              🚨 Emergency Meeting
            </button>
          )}

          {isCreator && (
            <button className="end-game-btn" onClick={endGameRound}>
              End Game Round
            </button>
          )}
        </div>
      </div>
    )}
  </div>
</div>
}

export default Countdown;
