import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { db, realtimeDb, ref, onDisconnect, set, remove } from './firebase';  // Import Realtime Database functions
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc, onSnapshot, deleteDoc, deleteField } from "firebase/firestore";  // Firestore functions

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

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    const playerRef = ref(realtimeDb, `games/${gameCode}/players/${playerName}`);
    
    if (playerName) {
      getDoc(gameRef).then((docSnapshot) => {
        if (docSnapshot.exists()) {
          const gameData = docSnapshot.data();
          setIsCreator(gameData.creator === playerName);
          setImposterHistory(gameData.imposterHistory || {}); // Load imposter history
          setImposterCount(gameData.imposterCount || 1); // Load imposter count from Firestore
          setTasksPerCrewmate(gameData.tasksPerCrewmate || 3); // Load tasks per crewmate from Firestore
          updateDoc(gameRef, {
            players: arrayUnion(playerName)
          });
        } else {
          // Create the game document
          setDoc(gameRef, {
            players: [playerName],
            creator: playerName,
            gameStarted: false,
            imposterHistory: {}, // Initialize imposter history
            imposterCount: 1, // Initialize imposter count
            tasksPerCrewmate: 3 // Initialize tasks per crewmate
          });
          setIsCreator(true);
        }
  
        setLoading(false);  // Loading is done after this initial process
      });
  
      set(playerRef, { connected: true });
  
      onDisconnect(playerRef).remove().then(() => {
        updateDoc(gameRef, {
          players: arrayRemove(playerName)
        });
      });
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
        setPlayers(gameData.players || []);
        setTasks(gameData.tasks || []);
        setIsCreator(gameData.creator === playerName);
        setImposterHistory(gameData.imposterHistory || {}); // Update imposter history

        // If the game has started and we're not already on the countdown screen
        if (gameData.gameStarted && !location.state?.onCountdownScreen) {
          navigate(`/countdown/${gameCode}`, { state: { playerName, isCreator, gameStarted: true, onCountdownScreen: true } });
        }
      }
    });

    return () => unsubscribe();
  }, [gameCode, playerName, navigate, location.state]);

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

  // Assign roles and update gameStarted flag
  const startGame = async () => {
    if (players.length > 1 && imposterCount <= players.length - 1) {  // Ensure valid imposter count

      const gameRef = doc(db, "games", gameCode);

      await updateDoc(gameRef, {
        killList: [],
        completedTasks: deleteField(),  // Remove the entire completedTasks field from Firestore
        winner: deleteField(),
        meetingCalled: false
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
      const assignedTasks = {};
      crewmates.forEach((crewmate) => {
        assignedTasks[crewmate] = shuffleArray([...tasks]).slice(0, tasksPerCrewmate);  // Each crewmate gets 3 random tasks
      });

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
    {player}
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
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
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