import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, 
        GoogleAuthProvider, signInWithPopup } 
from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, 
         where, getDocs, doc, setDoc } 
from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyDGhXciDa1dA__5N6eZgz1T36mbwsGtMQE",
    authDomain: "chat-app-1c611.firebaseapp.com",
    projectId: "chat-app-1c611",
    storageBucket: "chat-app-1c611.firebasestorage.app",
    messagingSenderId: "256123898310",
    appId: "1:256123898310:web:799528eaa846e2705e0ac7",
    measurementId: "G-VL91EJP36Q"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentChatUser = null;


// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Add Google Sign In function
window.signInWithGoogle = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        alert('Error signing in with Google: ' + error.message);
    }
};

// Previous functions remain the same...
window.login = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert('Error logging in: ' + error.message);
    }
};

window.signup = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert('Error signing up: ' + error.message);
    }
};

window.logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        alert('Error logging out: ' + error.message);
    }
};

// Function to create or update user document
async function updateUserPresence(user) {
    try {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, {
            userId: user.uid,
            email: user.email,
            lastSeen: serverTimestamp()
        }, { merge: true }); // merge: true will update existing doc or create if doesn't exist
    } catch (error) {
        console.error("Error updating user presence:", error);
    }
}

// Function to render users list
// async function renderUsersList() {
//     const usersQuery = query(collection(db, "users"));
//     const usersDiv = document.getElementById('usersList');
//     usersDiv.innerHTML = '<h3>Select a user to chat with:</h3>';
    
//     onSnapshot(usersQuery, (snapshot) => {
//         const userButtons = [];
//         snapshot.forEach((doc) => {
//             const userData = doc.data();
//             if (userData.userId !== auth.currentUser.uid) {
//                 const userButton = document.createElement('button');
//                 userButton.className = 'user-select-btn';
//                 userButton.textContent = userData.email.split('@')[0];
//                 userButton.onclick = () => selectUser(userData.userId, userData.email);
//                 userButtons.push(userButton);
//             }
//         });
        
//         // Clear existing buttons and add new ones
//         const existingButtons = usersDiv.querySelectorAll('.user-select-btn');
//         existingButtons.forEach(button => button.remove());
//         userButtons.forEach(button => usersDiv.appendChild(button));
//     });
// }

async function renderUsersList() {
    const usersQuery = query(collection(db, "users"));
    const usersDiv = document.getElementById('usersList');
    
    // Ensure the structure exists
    if (!usersDiv.querySelector('.search-container')) {
        usersDiv.innerHTML = `
            <h3>Select a user to chat with:</h3>
            <div id="userButtonsContainer"></div>
        `;
    }

    const buttonContainer = document.getElementById('userButtonsContainer');
    const searchInput = document.getElementById('userSearchInput');

    onSnapshot(usersQuery, (snapshot) => {
        // Store all users
        const allUsers = [];
        snapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.userId !== auth.currentUser.uid) {
                allUsers.push({
                    userId: userData.userId,
                    email: userData.email,
                    displayName: userData.email.split('@')[0]
                });
            }
        });

        // Function to render filtered users
        function renderFilteredUsers(searchTerm = '') {
            buttonContainer.innerHTML = ''; // Clear existing buttons
            
            allUsers.forEach(user => {
                if (user.displayName.toLowerCase().includes(searchTerm.toLowerCase())) {
                    const userButton = document.createElement('button');
                    userButton.className = 'user-select-btn';
                    userButton.textContent = user.displayName;
                    // userButton.onclick = () => selectUser(user.userId, user.email);
                    userButton.onclick = () => {
                        document.querySelectorAll('.user-select-btn').forEach(btn => btn.classList.remove('selected')); // Remove previous selections
                        userButton.classList.add('selected'); // Add selected class to clicked button
                        selectUser(user.userId, user.email);
                    };
                    buttonContainer.appendChild(userButton);
                }
            });
        }

        // Initial render
        renderFilteredUsers('');

        // Add search functionality
        searchInput.addEventListener('input', (e) => {
            renderFilteredUsers(e.target.value);
        });
    });
}


// Modified auth state observer
onAuthStateChanged(auth, async (user) => {
    const authContainer = document.getElementById('authContainer');
    const container = document.getElementsByClassName('container')[0];
    const chatContainer = document.getElementById('chatContainer');
    const userEmail = document.getElementById('userEmail');

    if (user) {
        // Update user presence
        await updateUserPresence(user);
        
        authContainer.style.display = 'none';
        chatContainer.style.display = 'grid';
        container.style.display = '';
        userEmail.textContent = user.email.split('@')[0];
        renderUsersList();
    } else {
        authContainer.style.display = 'block';
        chatContainer.style.display = 'none';
        container.style.display = 'none';
        userEmail.textContent = '';
    }
});

// Function to get chat ID between two users
function getChatId(user1, user2) {
    return [user1, user2].sort().join('_');
}

// Function to select a user to chat with
function selectUser(userId, userEmail) {
    currentChatUser = { userId, username: userEmail.split('@')[0] };
    document.getElementById('currentChatUser').textContent = `Chatting with: ${currentChatUser.username}`;
    setupPrivateMessageListener();
}

// Modified sendMessage function for private chat
window.sendMessage = async () => {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (!message || !currentChatUser) return;

    try {
        const chatId = getChatId(auth.currentUser.uid, currentChatUser.userId);
        await addDoc(collection(db, "private_messages"), {
            chatId: chatId,
            text: message,
            senderId: auth.currentUser.uid,
            senderEmail: auth.currentUser.email,
            receiverId: currentChatUser.userId,
            createdAt: serverTimestamp()
        });
        messageInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message. Please try again.');
    }
};

// Modified message listener for private chat
function setupPrivateMessageListener() {
    if (!currentChatUser) return;
    
    const chatId = getChatId(auth.currentUser.uid, currentChatUser.userId);
    const messagesQuery = query(
        collection(db, "private_messages"),
        where("chatId", "==", chatId),
        orderBy("createdAt")
    );

    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = ''; // Clear previous messages

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const message = change.doc.data();
                const messageElement = document.createElement('div');
                messageElement.className = `message ${
                    message.senderId === auth.currentUser.uid ? 'sent' : 'received'
                }`;
                const senderUsername = message.senderEmail.split('@')[0];
                // messageElement.textContent = `${senderUsername}: ${message.text}`;
                messageElement.textContent = `${message.text}`;
                messagesDiv.appendChild(messageElement);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        });
    }, (error) => {
        console.error("Error in message listener:", error);
    });

    // Store unsubscribe function for cleanup
    window.currentUnsubscribe = unsubscribe;
}

// Cleanup listener when switching chats
window.addEventListener('beforeunload', () => {
    if (window.currentUnsubscribe) {
        window.currentUnsubscribe();
    }
});

// Modified auth state observer
onAuthStateChanged(auth, async (user) => {
    const authContainer = document.getElementById('authContainer');
    const container = document.getElementsByClassName('container')[0];
    const chatContainer = document.getElementById('chatContainer');
    const userEmail = document.getElementById('userEmail');

    if (user) {
        // Store user info in Firestore for users list
        try {
            await addDoc(collection(db, "users"), {
                userId: user.uid,
                email: user.email,
                lastSeen: serverTimestamp()
            });
        } catch (error) {
            console.log("User might already exist");
        }

        authContainer.style.display = 'none';
        chatContainer.style.display = 'grid';
        container.style.display = '';
        userEmail.textContent = user.email.split('@')[0];
        renderUsersList();
    } else {
        authContainer.style.display = 'block';
        chatContainer.style.display = 'none';
        container.style.display = 'none';
        userEmail.textContent = '';
    }
});


document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        window.sendMessage();
    }
});