// fillInBlack.js
// Simple "Fill in the Blank quiz feature"

// Example usage:
// createFillInBlank("The capital of France is ___", Paris, "quiz-container");

export function createFillInBlank(questionText, correctAnswer, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Container with id ', ${containerId}, ' does not exist.');
        return;
    }

    // Split question into parts around the blank
    const parts = questionText.split("___");

    // Create elements
    const questionDiv = document.createElement("div");
    questionDiv.className = "fig-question";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "fib-input";
    input.placeholder = "Type your answer";

    const checkButton = document.createElement("button");
    checkButton.textContent = "Check Answer";
    checkButton.className = "fib-button";

    const feedback = document.createElement("div");
    feedback.className = "fib-feedback";

    // Build question display
    questionDiv.append(document.createTextNode(parts[0]));
    questionDiv.append(input);
    if (parts[1]) questionDiv.append(document.createTextNode(parts[1]));

    // Add everything to container
    container.appendChild(questionDiv);
    container.appendChild(checkButton);
    container.appendChild(feedback);

    // Check logic
    checkButton.addEventListener("click", () => {
        const userAnswer = input.value.trim();
        if (userAnswer.length === 0) {
            feedback.textContent = "Please enter an answer.";
            feedback.style.color = "gray";
        } else if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
            feedback.textContent = "You got it!";
            feedback.style.color = "green";
        } else {
            feedback.textContent = "Nope! The correct answer is ", ${correctAnswer}".";
            feedback.style.color - "red";
        }
    });
}