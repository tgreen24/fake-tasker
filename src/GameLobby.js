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
  const maxPlayers = 15;

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    const playerRef = ref(realtimeDb, `games/${gameCode}/players/${playerName}`);
    
    if (playerName) {
      getDoc(gameRef).then((docSnapshot) => {
        if (docSnapshot.exists()) {
          updateDoc(gameRef, {
            players: arrayUnion(playerName)
          });
          const gameData = docSnapshot.data();
          setIsCreator(gameData.creator === playerName);
        } else {
          // Create the game document
          setDoc(gameRef, {
            players: [playerName],
            creator: playerName,
            gameStarted: false
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

          
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
      const imposters = shuffledPlayers.slice(0, imposterCount);
      const crewmates = shuffledPlayers.slice(imposterCount);

      const roles = {};
      imposters.forEach((imposter) => {
        roles[imposter] = 'Imposter';
      });
      crewmates.forEach((crewmate) => {
        roles[crewmate] = 'Crewmate';
      });

      // Assign tasks randomly to crewmates
      const assignedTasks = {};
      crewmates.forEach((crewmate) => {
        assignedTasks[crewmate] = tasks.sort(() => Math.random() - 0.5).slice(0, 3);  // Each crewmate gets 3 random tasks
      });  

      await updateDoc(gameRef, { roles, gameStarted: true, assignedTasks });  // Mark game as started with reshuffled roles

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
      <div className="player-name">
        <h2>{playerName}</h2>
      </div>

      <h2>Game Lobby</h2>
      <p>Game Code: <strong>{gameCode}</strong></p>
      <div>
        <h3>Players ({players.length}/{maxPlayers}):</h3>
        <ul>
          {players.map((player, index) => (
            <li key={index}>{player}</li>
          ))}
        </ul>
      </div>

      {isCreator && (
        <div>
          <button onClick={startGame} disabled={players.length < 2}>
            Start Game
          </button>
          <button onClick={finishGame} disabled={players.length === 0}>
            Finish Game and Delete Data
          </button>

          {players.length > 3 ? (
            <div>
              <label>
                Number of Imposters:
                <select
                  value={imposterCount}
                  onChange={(e) => setImposterCount(Number(e.target.value))}
                >
                  {[1, 2, 3].map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <p>There will be 1 imposter.</p>
          )}

        <div>
            <h3>Tasks</h3>
            <ul>
                {tasks.map((task, index) => (
                <li key={index}>{task}</li>
                ))}
            </ul>
            <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Enter new task"
            />
            <button onClick={addTask}>Add Task</button>
            </div>

        </div>
      )}
    </div>
  );
}

export default GameLobby;
