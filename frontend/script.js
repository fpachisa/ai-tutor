document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCES TO HTML ELEMENTS ---
    const problemTextElement = document.getElementById('problem-text');
    const answerInputElement = document.getElementById('answer-input');
    const submitButton = document.getElementById('submit-button');
    const feedbackArea = document.getElementById('feedback-area');

    // --- STATE MANAGEMENT ---
    const currentProblemId = '1';
    // This is the crucial new piece: an array to store the entire conversation.
    let chatHistory = []; 
    
    
    function renderChatHistory() {
        feedbackArea.innerHTML = ''; // Clear the feedback area first
        
        chatHistory.forEach(turn => {
            const turnDiv = document.createElement('div');
            turnDiv.classList.add('chat-turn');
            let contentHTML = '';

            if (turn.role === 'user') {
                turnDiv.classList.add('user-turn');
                contentHTML = `<p><strong>You:</strong> ${turn.parts[0]}</p>`;
            } else { // This is a 'model' (Tutor) turn
                turnDiv.classList.add('model-turn');
                const partText = turn.parts[0];

                // Defensive Check: Is this a JSON string or plain text?
                // We check if the string starts with '{' which is a reliable indicator for our use case.
                if (partText && partText.trim().startsWith('{')) {
                    // It's JSON, so we parse it and format it.
                    try {
                        const feedback = JSON.parse(partText);
                        contentHTML = `
                            <p><strong>Tutor:</strong> ${feedback.encouragement}</p>
                            <p>${feedback.socratic_question}</p>
                        `;
                    } catch (e) {
                        // If parsing fails for some reason, display the raw text to avoid crashing.
                        console.error("Failed to parse model response:", partText);
                        contentHTML = `<p><strong>Tutor:</strong> I seem to be having a formatting issue. Please try again.</p>`;
                    }
                } else {
                    // It's just a plain text string (like the final "Correct!" message).
                    contentHTML = `<p><strong>Tutor:</strong> ${partText}</p>`;
                }
            }
            
            turnDiv.innerHTML = contentHTML;
            feedbackArea.appendChild(turnDiv);
        });

        // Scroll to the bottom of the chat
        feedbackArea.scrollTop = feedbackArea.scrollHeight;
    }
    // --- FUNCTION TO FETCH THE PROBLEM ---
    async function fetchProblem() {

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/problems/${currentProblemId}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const problem = await response.json();
            problemTextElement.innerText = problem.problem_text;
        } catch (error) {
            problemTextElement.innerText = 'Failed to load problem. Make sure the backend server is running.';
            console.error('There was a problem with the fetch operation:', error);
        }
    }


    async function submitAnswer() {
        const studentAnswer = answerInputElement.value;
        if (!studentAnswer) return;

        // Add user's message to our local history (this part is correct)
        chatHistory.push({ role: 'user', parts: [studentAnswer] });
        renderChatHistory();
        answerInputElement.value = '';

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tutor/submit_answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem_id: currentProblemId,
                    student_answer: studentAnswer,
                    chat_history: chatHistory, 
                }),
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const result = await response.json();

            if (result.is_correct) {
                // The final correct response is just a simple string, which is fine
                chatHistory.push({ role: 'model', parts: [result.feedback.encouragement] });
            } else {
                // **THE FIX IS HERE:**
                // We convert the feedback OBJECT back into a STRING before pushing to history.
                chatHistory.push({ role: 'model', parts: [JSON.stringify(result.feedback)] });
            }
            // Re-render the chat with the new turn from the AI
            renderChatHistory();

        } catch (error) {
            feedbackArea.innerText = 'Error communicating with the tutor.';
            console.error('There was a problem with the fetch operation:', error);
        }
    }

    // --- ATTACH EVENT LISTENERS ---
    fetchProblem();
    submitButton.addEventListener('click', submitAnswer);
    answerInputElement.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            submitAnswer();
        }
    });
});