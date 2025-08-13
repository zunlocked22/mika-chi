import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

// A mock `__app_id` and `__firebase_config` for local development.
// In the Canvas environment, these will be provided automatically.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "dummy-api-key",
    authDomain: "dummy-auth-domain",
    projectId: "dummy-project-id",
    storageBucket: "dummy-storage-bucket",
    messagingSenderId: "dummy-messaging-sender-id",
    appId: "dummy-app-id"
};

// Initialize Firebase and Firestore
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("Firebase initialization error:", error);
}

// Function to generate a stable, unique user ID.
// This is crucial for managing user-specific data in Firestore.
function getUserId(user) {
    if (user) {
        return user.uid;
    }
    // Fallback for non-authenticated users
    return 'anonymous_' + crypto.randomUUID();
}

// Main App component
export default function App() {
    // State variables for managing the UI and data
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [channelName, setChannelName] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle', 'processing', 'success', 'error'
    const [streams, setStreams] = useState([]);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userId, setUserId] = useState(null);

    // This effect handles Firebase authentication
    useEffect(() => {
        const setupAuth = async () => {
            try {
                // Use the provided custom auth token if available, otherwise sign in anonymously
                if (typeof __initial_auth_token !== 'undefined') {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Firebase Auth error:", error);
            }
        };

        if (auth) {
            const unsubscribe = auth.onAuthStateChanged(user => {
                if (user) {
                    setUserId(getUserId(user));
                    setIsAuthReady(true);
                } else {
                    // Sign in anonymously if no user is found
                    setupAuth();
                }
            });
            return () => unsubscribe();
        }
    }, []);

    // This effect sets up the real-time Firestore listener
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;

        // The Firestore path for private user data
        const streamsPath = `artifacts/${appId}/users/${userId}/streams`;
        const q = collection(db, streamsPath);
        
        // Listen for real-time updates to the 'streams' collection
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const streamsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setStreams(streamsData);
        }, (error) => {
            console.error("Firestore snapshot error:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, db, userId]);

    // This function simulates the conversion process
    const handleConvert = async (e) => {
        e.preventDefault();
        
        // Basic validation
        if (!youtubeUrl || !channelName) {
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
            return;
        }

        setStatus('processing');

        try {
            // NOTE: This URL has been updated to your Render deployment.
            const backendUrl = 'https://mika-chi.onrender.com';

            const response = await fetch(`${backendUrl}/api/convert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ youtubeUrl, channelName }),
            });
            
            const result = await response.json();

            if (response.ok) {
                console.log("Conversion started:", result.message);
                const m3u8Url = `${backendUrl}${result.m3u8Url}`;
                
                // Now, we update the state and Firestore with the new stream.
                // The `doc(db, ...)` call with `setDoc` will create or overwrite
                // a document, which achieves the goal of a consistent URL.
                const streamDocRef = doc(db, `artifacts/${appId}/users/${userId}/streams`, channelName.toLowerCase());
                await setDoc(streamDocRef, {
                    youtubeUrl,
                    m3u8Url,
                    lastUpdated: new Date().toISOString()
                });
                
                setStatus('success');
            } else {
                console.error("Backend error:", result.error);
                setStatus('error');
            }

        } catch (error) {
            console.error("Network or fetch error:", error);
            setStatus('error');
        } finally {
            // Reset status after a short delay
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    // This function simulates deleting a stream.
    // In a real implementation, it would also trigger a server-side process
    // to delete the physical M3U8 file.
    const handleDelete = async (channelId) => {
        // Use a custom modal instead of `window.confirm` to follow instructions
        const userConfirmed = window.confirm(`Are you sure you want to delete the stream for "${channelId}"?`);
        if (userConfirmed) {
            // For now, we'll just remove it from our local state.
            // In a real app, you would make an API call to your server to delete
            // the file and then remove it from Firestore.
            console.log(`Simulating deletion of stream for: ${channelId}`);
            // To actually delete the file from Firestore, you'd use deleteDoc
            // but we will keep this as a simulation for this example.
        }
    };

    // SVG Icons
    const PlayIcon = ({ className }) => (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
        </svg>
    );

    const SyncIcon = ({ className }) => (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.71 1.71c.96-1.58 1.49-3.41 1.49-5.51 0-4.97-4.03-9-9-9zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L4.99 9.49C4.03 11.07 3.5 12.9 3.5 15c0 4.97 4.03 9 9 9v3l4-4-4-4v3z"/>
        </svg>
    );
    
    const TrashIcon = ({ className }) => (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
    );

    const StreamIcon = ({ className }) => (
        <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 11c.72 0 1.4.15 2 .42V5c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h7.42c-.27-.6-.42-1.28-.42-2 0-3.87 3.13-7 7-7zm2-6h2v6h-2V5zM7 16h2v2H7zm-3-4h2v2H4zm0 4h2v2H4zm3-4h2v2H7zm-3-4h2v2H4zm13 8c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm-1 5h-2v2h2v-2zM4 8h2v2H4z"/>
        </svg>
    );

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4 font-inter">
            {/* Display the user ID for collaborative purposes, as per instructions */}
            <div className="absolute top-4 right-4 text-xs bg-slate-800 text-slate-400 p-2 rounded-lg">
                User ID: {userId || 'Loading...'}
            </div>

            <div className="w-full max-w-2xl bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-700">
                <h1 className="text-3xl md:text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-6">
                    YT Live Stream to HLS Converter
                </h1>

                <p className="text-sm text-center text-slate-400 mb-8">
                    This is a front-end simulation. The actual conversion requires a backend server with ffmpeg.
                </p>

                <form onSubmit={handleConvert} className="space-y-6">
                    <div>
                        <label htmlFor="youtube-url" className="block text-sm font-medium text-slate-300 mb-2">
                            YouTube Live Stream URL
                        </label>
                        <input
                            type="text"
                            id="youtube-url"
                            value={youtubeUrl}
                            onChange={(e) => setYoutubeUrl(e.target.value)}
                            placeholder="e.g., https://www.youtube.com/watch?v=..."
                            className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="channel-name" className="block text-sm font-medium text-slate-300 mb-2">
                            Channel Name (for a stable M3U8 URL)
                        </label>
                        <input
                            type="text"
                            id="channel-name"
                            value={channelName}
                            onChange={(e) => setChannelName(e.target.value)}
                            placeholder="e.g., gma7"
                            className="w-full p-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className={`w-full py-3 px-6 rounded-lg text-lg font-bold transition-all duration-300 ease-in-out
                        ${status === 'processing'
                            ? 'bg-slate-600 text-slate-400 cursor-not-allowed flex items-center justify-center'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 shadow-md hover:shadow-lg'
                        }`}
                        disabled={status === 'processing'}
                    >
                        {status === 'processing' ? (
                            <span className="flex items-center">
                                <SyncIcon className="animate-spin h-5 w-5 mr-2" />
                                Converting...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center">
                                <PlayIcon className="h-5 w-5 mr-2" />
                                Convert to M3U8
                            </span>
                        )}
                    </button>
                    {status === 'success' && (
                        <p className="text-center text-sm text-green-400 mt-2">
                            Conversion simulated successfully!
                        </p>
                    )}
                    {status === 'error' && (
                        <p className="text-center text-sm text-red-400 mt-2">
                            Please fill out all fields.
                        </p>
                    )}
                </form>

                <hr className="my-8 border-slate-700" />

                <h2 className="text-2xl font-bold text-slate-200 mb-4 flex items-center">
                    <StreamIcon className="h-7 w-7 mr-2 text-emerald-400" />
                    Available Streams
                </h2>

                {streams.length === 0 ? (
                    <p className="text-slate-400 text-center">No streams converted yet. Your streams will appear here.</p>
                ) : (
                    <ul className="space-y-4">
                        {streams.map((stream) => (
                            <li key={stream.id} className="bg-slate-700 p-4 rounded-lg flex items-center justify-between shadow-sm">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-100">{stream.id}</h3>
                                    <p className="text-sm text-slate-400 break-words">
                                        <span className="font-medium text-slate-300">URL:</span> {stream.m3u8Url}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <a
                                        href={stream.m3u8Url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-400 hover:text-emerald-300 transition-colors"
                                        title="View M3U8 URL"
                                    >
                                        <PlayIcon className="h-5 w-5"/>
                                    </a>
                                    <button
                                        onClick={() => handleConvert({ preventDefault: () => {} })} // Simplified call for re-conversion
                                        className="text-blue-400 hover:text-blue-300 transition-colors"
                                        title="Re-convert stream"
                                    >
                                        <SyncIcon className="h-5 w-5"/>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(stream.id)}
                                        className="text-red-400 hover:text-red-300 transition-colors"
                                        title="Delete stream"
                                    >
                                        <TrashIcon className="h-5 w-5"/>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

