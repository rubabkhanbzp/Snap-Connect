function likePost(postId) {
    fetch(`/like/${postId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Post liked!');
            } else {
                alert('Failed to like the post.');
            }
        })
        .catch(error => console.error('Error liking post:', error));
}

function commentOnPost(postId) {
    const commentContent = document.getElementById(`comment-input-${postId}`).value;

    fetch(`/comment/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentContent })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Comment added!');
            } else {
                alert('Failed to add comment.');
            }
        })
        .catch(error => console.error('Error commenting on post:', error));
}

function toggleFollow(userId) {
    const button = document.querySelector(`button[onclick="toggleFollow('${userId}')"]`);
    if (button.textContent === 'Follow') {
        followUser(userId, button);
    } else {
        unfollowUser(userId, button);
    }
}

function followUser(userId, button) {
    fetch(`/follow/${userId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                button.textContent = 'Unfollow';
                button.setAttribute('onclick', `toggleFollow('${userId}')`);
                updateCounts(); 
            } else {
                alert('Failed to follow the user.' + (data.message || 'Unknown error'));
            }
        })
        .catch(error => console.error('Error following user:', error));
}

function unfollowUser(userId, button) {
    fetch(`/unfollow/${userId}`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                button.textContent = 'Follow';
                button.setAttribute('onclick', `toggleFollow('${userId}')`);
                updateCounts(); 
            } else {
                alert('Failed to unfollow the user.');
            }
        })
        .catch(error => console.error('Error unfollowing user:', error));
}


function updateCounts() {
    fetch('/profile/counts')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('followersCount').textContent = data.followersCount;
                document.getElementById('followingCount').textContent = data.followingCount;
            } else {
                console.error('Failed to update counts:', data.message);
            }
        })
        .catch(error => console.error('Error updating counts:', error));
}

setInterval(updateCounts, 1000);

document.addEventListener('DOMContentLoaded', updateCounts);

