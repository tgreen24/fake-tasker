import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { db } from './firebase';  // Import Firestore
import { doc, setDoc, updateDoc, arrayRemove, getDoc, onSnapshot, deleteDoc, deleteField } from "firebase/firestore";  // Firestore functions

function GameLobby() {
  const { gameCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [tasks, setTasks] = useState([]);  // Tasks list
  const [newTask, setNewTask] = useState("");  // New task input
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imposterCount, setImposterCount] = useState(1);  // Default to 1 imposter
  const playerName = location.state?.playerName || '';  // Get player name from location state
  const [tasksPerCrewmate, setTasksPerCrewmate] = useState(3);
  const maxPlayers = 25;
  const [imposterHistory, setImposterHistory] = useState({}); // Track imposter history
  const [killCooldown, setKillCooldown] = useState(30); // Default cooldown in seconds

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    if (playerName) {
      getDoc(gameRef).then(async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const gameData = docSnapshot.data();
          setIsCreator(gameData.creator === playerName);
          setImposterHistory(gameData.imposterHistory || {}); // Load imposter history
          setImposterCount(gameData.imposterCount || 1); // Load imposter count from Firestore
          setTasksPerCrewmate(gameData.tasksPerCrewmate || 3); // Load tasks per crewmate from Firestore
          setKillCooldown(gameData.killCooldown || 30); // Load kill cooldown from Firestore
        } else {
          // Create the game document
          await setDoc(gameRef, {
            players: [playerName],
            creator: playerName,
            gameStarted: false,
            imposterHistory: {}, // Initialize imposter history
            imposterCount: 1, // Initialize imposter count
            tasksPerCrewmate: 3, // Initialize tasks per crewmate
            killCooldown: 30 // Initialize kill cooldown
          });
          setIsCreator(true);
        }

        setLoading(false);  // Loading is done after this initial process
      }).catch((error) => {
        console.error("Error loading game data:", error);
        setLoading(false); // Stop loading even on error
      });
    } else {
      console.error("No playerName provided");
      setLoading(false); // Stop loading if no player name
    }
  }, [gameCode, playerName, location.state]);

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
  
    const unsubscribe = onSnapshot(gameRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        console.log("Game document exists, no need to navigate.");
      } else if (!loading) {  // Only navigate if it's not during initial loading
        console.log("Game deleted. Navigating to home...");
        navigate("/");
      }
    });
  
    return () => unsubscribe();  // Clean up the listener on component unmount
  }, [gameCode, navigate, loading]);

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);

    const unsubscribe = onSnapshot(gameRef, (doc) => {
      if (doc.exists()) {
        const gameData = doc.data();
        const playersList = gameData.players || [];
        setPlayers(playersList);
        setTasks(gameData.tasks || []);
        setIsCreator(gameData.creator === playerName);
        setImposterHistory(gameData.imposterHistory || {}); // Update imposter history

        // Check if current player was kicked (not in players list anymore)
        if (playerName && !playersList.includes(playerName)) {
          console.log(`Player ${playerName} was kicked. Navigating to home...`);
          alert("You have been removed from the game.");
          navigate("/");
          return;
        }

        // If the game has started and we're not already on the countdown screen
        if (gameData.gameStarted && !location.state?.onCountdownScreen) {
          navigate(`/countdown/${gameCode}`, { state: { playerName, isCreator, gameStarted: true, onCountdownScreen: true } });
        }
      }
    });

    return () => unsubscribe();
  }, [gameCode, playerName, navigate, location.state]);

  // Navigation sync: Check game state on mount and when page becomes visible
  useEffect(() => {
    // Don't run sync until initial loading is complete
    if (loading) return;

    const syncNavigationState = async () => {
      if (!gameCode || !playerName) return;

      const gameRef = doc(db, "games", gameCode);
      const docSnapshot = await getDoc(gameRef);

      if (!docSnapshot.exists()) {
        // Game deleted, go home
        navigate("/");
        return;
      }

      const gameData = docSnapshot.data();

      // Check if game started while we were away
      if (gameData.gameStarted) {
        navigate(`/countdown/${gameCode}`, { state: { playerName, isCreator: gameData.creator === playerName, gameStarted: true } });
      }
    };

    // Sync when page becomes visible (user returns from backgrounding)
    const handleVisibilityChange = () => {
      if (!document.hidden && !loading) {
        console.log('[GameLobby] Page foregrounded, syncing navigation state');
        syncNavigationState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameCode, playerName, navigate, loading]);

  // Add a new task to the list
  const addTask = () => {
    if (newTask.trim() !== "") {
      const updatedTasks = [...tasks, newTask.trim()];
      setTasks(updatedTasks);
      setNewTask("");  // Clear input
  
      // Save tasks to Firestore
      const gameRef = doc(db, "games", gameCode);
      updateDoc(gameRef, { tasks: updatedTasks });
    }
  };

  function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
  
    // While there remain elements to shuffle...
    while (currentIndex !== 0) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
  }

  function calculateWeights(players, history) {
    const maxImposterCount = Math.max(0, ...Object.values(history));
    const weights = {};

    players.forEach(player => {
      const weight = maxImposterCount - (history[player] || 0) + 1; // +1 to avoid zero weight
      weights[player] = weight;
    });

    return weights;
  }

  function selectImposters(players, weights, imposterCount) {
    const weightedPlayers = [];

    players.forEach(player => {
      for (let i = 0; i < weights[player]; i++) {
        weightedPlayers.push(player);
      }
    });

    const shuffledWeightedPlayers = shuffleArray(weightedPlayers);
    const selectedImposters = new Set();

    while (selectedImposters.size < imposterCount && shuffledWeightedPlayers.length > 0) {
      const candidate = shuffledWeightedPlayers.pop();
      selectedImposters.add(candidate);
    }

    return Array.from(selectedImposters);
  }

  function assignTasksEvenly(crewmates, tasks, tasksPerCrewmate) {
    const assignedTasks = {};
    const totalTasks = tasks.length;
    const shuffledTasks = shuffleArray([...tasks]);
  
    // Initialize each crewmate's task list
    crewmates.forEach(crewmate => {
      assignedTasks[crewmate] = [];
    });
  
    let taskIndex = 0;
    let assignments = 0;
  
    // Distribute tasks ensuring no duplicates for a single crewmate
    while (assignments < tasksPerCrewmate * crewmates.length) {
      crewmates.forEach(crewmate => {
        if (assignedTasks[crewmate].length < tasksPerCrewmate) {
          // Check if the task is already assigned to this crewmate
          while (assignedTasks[crewmate].includes(shuffledTasks[taskIndex % totalTasks])) {
            taskIndex++;
          }
          assignedTasks[crewmate].push(shuffledTasks[taskIndex % totalTasks]);
          taskIndex++;
          assignments++;
        }
      });
    }
  
    return assignedTasks;
  }
  

  // Assign roles and update gameStarted flag
  const startGame = async () => {
    // Validate that there are enough tasks
    if (tasks.length === 0) {
      alert("Please add at least one task before starting the game.");
      return;
    }

    if (tasks.length < tasksPerCrewmate) {
      alert(`Not enough tasks. You need at least ${tasksPerCrewmate} tasks (current tasks per crewmate setting).`);
      return;
    }

    if (players.length > 1 && imposterCount <= players.length - 1) {  // Ensure valid imposter count

      const gameRef = doc(db, "games", gameCode);

      await updateDoc(gameRef, {
        killList: [],
        completedTasks: deleteField(),  // Remove the entire completedTasks field from Firestore
        winner: deleteField(),
        meetingCalled: false,
        sabotages: deleteField()
       });
    
      // Now clear completed tasks for all players by reinitializing the field
      const clearedCompletedTasks = {};
      players.forEach(player => {
        clearedCompletedTasks[player] = [];  // Reset completed tasks to an empty array for each player
      });

      await updateDoc(gameRef, {
        completedTasks: clearedCompletedTasks  // Reinitialize the completedTasks field in Firestore
      });

      const weights = calculateWeights(players, imposterHistory);
      const imposters = selectImposters(players, weights, imposterCount);
      const crewmates = players.filter(player => !imposters.includes(player));

      const roles = {};
      imposters.forEach((imposter) => {
        roles[imposter] = 'Imposter';
        imposterHistory[imposter] = (imposterHistory[imposter] || 0) + 1; // Update history
      });
      crewmates.forEach((crewmate) => {
        roles[crewmate] = 'Crewmate';
      });

      // Assign tasks randomly to crewmates
      const assignedTasks = assignTasksEvenly(crewmates, tasks, tasksPerCrewmate);

      await updateDoc(gameRef, { roles, gameStarted: true, assignedTasks, imposterHistory });  // Mark game as started with reshuffled roles

      // Pass isCreator to Countdown screen
      navigate(`/countdown/${gameCode}`, { state: { playerName, isCreator, gameStarted: true, onCountdownScreen: true } });
    } else {
      alert("Invalid imposter count. Must have at least 1 crewmate.");
    }
  };

  const finishGame = async () => {
    const gameRef = doc(db, "games", gameCode);

    try {
      await deleteDoc(gameRef);  // Delete the game document from Firestore
      alert("Game ended and data deleted.");
      navigate("/");  // Navigate back to home
    } catch (error) {
      console.error("Error deleting document: ", error);
    }
  };

  const kickPlayer = async (playerToKick) => {
    if (playerToKick === playerName) {
      alert("You cannot kick yourself!");
      return;
    }

    const gameRef = doc(db, "games", gameCode);
    try {
      await updateDoc(gameRef, {
        players: arrayRemove(playerToKick)
      });
      console.log(`Kicked player: ${playerToKick}`);
    } catch (error) {
      console.error("Error kicking player: ", error);
    }
  };

  if (loading) {
    return <div>Loading game data...</div>;
  }

  return (
    <div className="game-lobby">
  <div className="lobby-header">
    <div className="game-code">
      Game Code: <strong>{gameCode}</strong>
    </div>
  </div>

  <div className="lobby-content">
    <div className="players-list">
      <h3>Players ({players.length}/{maxPlayers})</h3>
      <div className="player-grid">
      {players.map((player, index) => (
  <div
    key={index}
    className={`player-card ${player === playerName ? 'highlight' : ''}`}
  >
    <span>{player}</span>
    {isCreator && player !== playerName && (
      <button
        className="kick-button"
        onClick={() => kickPlayer(player)}
        title="Remove player"
      >
        ✕
      </button>
    )}
  </div>
))}
      </div>
    </div>

    {isCreator && (
      <div className="creator-controls">
        <div className="task-section">
          <h3>Tasks</h3>
          <ul>
            {tasks.map((task, index) => (
              <li key={index} className="task-item">{task}</li>
            ))}
          </ul>
          <div className="task-input">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Enter new task"
            />
            <button onClick={addTask}>Add Task</button>
          </div>
        </div>

        <div className="controls">
          <button onClick={startGame} disabled={players.length < 2} className="start-game-btn">
            Start Game
          </button>
          <button onClick={finishGame} disabled={players.length === 0} className="end-game-btn">
            Finish Game and Delete Data
          </button>
        </div>

        {players.length > 3 ? (
          <div className="imposter-select">
            <label>Number of Imposters:</label>
            <select
              value={imposterCount}
              onChange={(e) => {
                const newCount = Number(e.target.value);
                setImposterCount(newCount);
                const gameRef = doc(db, "games", gameCode);
                updateDoc(gameRef, { imposterCount: newCount }); // Persist imposter count to Firestore
              }}
            >
              {Array.from({ length: Math.max(1, Math.floor(players.length / 3)) }, (_, i) => i + 1).map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
        ) : (
          <p>There will be 1 imposter.</p>
        )}

        <div className="kill-cooldown-selection">
          <label>Kill Cooldown (seconds):</label>
          <select
            value={killCooldown}
            onChange={(e) => {
              const newCooldown = Number(e.target.value);
              setKillCooldown(newCooldown);
              const gameRef = doc(db, "games", gameCode);
              updateDoc(gameRef, { killCooldown: newCooldown }); // Persist kill cooldown to Firestore
            }}
          >
            {[10, 15, 20, 25, 30].map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} seconds
              </option>
            ))}
          </select>
        </div>

      <div className="task-count-selection">
          <label>Number of Tasks per Crewmate:</label>
          <select
            value={tasksPerCrewmate}
            onChange={(e) => {
              const newTaskCount = Number(e.target.value);
              setTasksPerCrewmate(newTaskCount);
              const gameRef = doc(db, "games", gameCode);
              updateDoc(gameRef, { tasksPerCrewmate: newTaskCount }); // Persist tasks per crewmate to Firestore
            }}
          >
            {Array.from({ length: Math.min(tasks.length, 10) }, (_, i) => i + 1).map((num) => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>
      </div>
    )}
  </div>
</div>

  );
}

export default GameLobby;