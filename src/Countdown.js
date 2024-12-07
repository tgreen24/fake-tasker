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

  useEffect(() => {
    if (countdown === 0) {
      const gameRef = doc(db, "games", gameCode);
      getDoc(gameRef).then((docSnapshot) => {
        if (docSnapshot.exists()) {
          const gameData = docSnapshot.data();
          const playerRole = gameData.roles[playerName];
          setRole(playerRole);
          setIsCreator(gameData.creator === playerName);
          setIsDead(gameData.killList?.includes(playerName));
  
          // If player is a crewmate, load their assigned tasks
          if (playerRole === 'Crewmate') {
            setTasks(gameData.assignedTasks[playerName] || []);
            setCompletedTasks(gameData.completedTasks?.[playerName] || []);
          }

          // Snippet 2: Imposter logic
          if (playerRole === 'Imposter') {
            setKillList(gameData.killList || []);  // Set kill list for imposters
            const crewmatesList = Object.keys(gameData.roles).filter(player => gameData.roles[player] === 'Crewmate').sort();
            setCrewmates(crewmatesList);  // Set the list of crewmates for imposters
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
        setRole(gameData.roles[playerName]);  // Set the role of the player
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
        
        // Get all crewmates
        const crewmatesList = Object.keys(gameData.roles)
          .filter(player => gameData.roles[player] === 'Crewmate')
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

        // If gameStarted is false, navigate everyone back to the lobby
        if (!gameData.gameStarted && !gameData.gameEnded) {
          console.log("Game round ended. Navigating back to lobby...");
          navigate(`/lobby/${gameCode}`, { state: { playerName, isCreator, gameStarted: false } });
        }

        if (gameData.gameEnded) {
            const result = gameData.roles[playerName] === 'Crewmate' && gameData.completedTasks
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
    const updatedKillList = killList.includes(crewmate)
      ? killList.filter((name) => name !== crewmate)  // Uncheck if already dead
      : [...killList, crewmate];  // Add crewmate to kill list
  
    setKillList(updatedKillList);
  
    // Update Firestore with new kill list
    const gameRef = doc(db, "games", gameCode);
    await updateDoc(gameRef, {
      killList: updatedKillList
    });

    await checkIfAllKillsCompleted(updatedKillList);
  };

  const checkIfAllKillsCompleted = async (updatedKillList) => {
    const gameRef = doc(db, "games", gameCode);
    const gameData = (await getDoc(gameRef)).data();
    const crewmates = Object.keys(gameData.roles).filter((player) => gameData.roles[player] === 'Crewmate');
    const allKillsCompleted = updatedKillList.length === crewmates.length - 1;
  
    if (allKillsCompleted) {
        // Navigate to the Game Over screen and pass lose state
        navigate(`/gameover/${gameCode}`, { state: { playerName, result: 'lose' } });
        await updateDoc(gameRef, { gameEnded: true });
      }
  };

  const toggleTaskCompletion = (task) => {
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
    
    // Get all crewmates
    const crewmates = Object.keys(gameData.roles).filter((player) => gameData.roles[player] === 'Crewmate');
    
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

        {role === 'Crewmate' && (
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
          <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${(totalCompletedTasks / totalTasks) * 100}%` }}
              >
                {Math.round((totalCompletedTasks / totalTasks) * 100)}%
              </div>
            </div>
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
            </div>
        )}

        <div className="buttons">
          {role && !isDead && (
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
