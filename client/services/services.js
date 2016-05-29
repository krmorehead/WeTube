angular.module('services', [])
	.factory('OAuth', function ($http) {
		var googleLogin = function (data) {
			return $http({
				method: 'GET',
				url: '/auth/google/callback'
			});
		}

		return {
			googleLogin: googleLogin
		};
	})

	.factory('auth', function ($http){

		var checkLoggedIn = function (token, nextLocation) {
			return false
		}

		var isAuthenticated = function(){
			return true
		}

		var updateLocation = function(){

		}
		return {
			checkLoggedIn: checkLoggedIn,
			isAuthenticated: isAuthenticated,
			updateLocation: updateLocation
		}

	})

	.factory('userData', function ($http) {
		var userData = {displayName:"a"}

		var createUser = function(userData){
			return $http({
				method: "POST",
				url: "/createUser",
				data: userData
			}).then(function(response){
				return response.data
			})

		}

		var loginUser = function(userData){
			return $http({
				method: "POST",
				url: "/login",
				data: userData
			}).then(function(response){
				return response.data
			})
		}

		var updateUserData = function(newUserData){
			userData = newUserData
		}

		var getUserData = function(){
			return userData
		}

		return {
			createUser: createUser,
			loginUser: loginUser,
			updateUserData: updateUserData,
			getUserData: getUserData
		}
	})

	.factory('search', function($http){
		var searchYoutube = function(searchQuery){
			return $http({
				method: "GET",
				url :"searchYoutube/" + searchQuery
			}).then(function(response){
				return response.data.items
			})
		}

		return{
			searchYoutube: searchYoutube
		}
	})

	.factory('getVideo', function ($window, $interval, $rootScope, bcrypt, userData, $state) {

		var onYoutubeStateChange = function() {
			console.log('state change!')

			socket.emit('clientPlayerStateChange', {
				stateChange: $window.youtubePlayer.getPlayerState(),
				room: videoId
			});

			if(host){
				socket.emit('hostPlayerState',
				{
					currentTime: $window.youtubePlayer.getCurrentTime(),
					currentState: $window.youtubePlayer.getPlayerState(),
					room : videoId
				});
			}
		};

		var host = false; 
		var currentVideo = '';
		var messages = [];

		//at the end of setupPlayer onYouTubeIframeAPIReady is automatically called
		var setupPlayer = function(source, isHost) {
			videoId = source
			host = isHost;
			// add source to the io stream

			var tag = document.createElement('script');
			tag.src = "https://www.youtube.com/iframe_api";
			var firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

		};
		//updated by setupPlayer b/c setupPlayer cannot directly pass into
		//onYouTubeIframeAPIReady

		$window.onYouTubeIframeAPIReady=function() {
			console.log('youtube iFrame ready!');
			$window.youtubePlayer = new YT.Player('player', {
				height: '400',
				width: '600',
				videoId: videoId,
				events: {
					'onStateChange': onYoutubeStateChange,
				}
			});
		}

			//sets up the socket stream and events
		var submitRoom = function(videoId, videoTitle, host, roomId){

			$window.socket = io.connect('http://localhost:8001');
			currentVideo = videoId

			var displayName = userData.getUserData().displayName 

			if(host){
				bcrypt.hash(displayName, 8, function(err, hash) {
					console.log("hash", hash)
					socket.emit('createRoom',{room : hash, roomTitle : videoTitle});
					$state.go("home.stream", {roomId: hash, currentVideo:videoId, host:true})

					setupPlayer(videoId, true)

					socket.on('newViewer', function(data){
						console.log("newViewer")
						socket.emit('currentVideo',{
							currentVideo: currentVideo,
							roomId : hash
						});

						if($window.youtubePlayer.getCurrentTime() > 0)
						socket.emit('hostPlayerState',
						{
							currentTime: $window.youtubePlayer.getCurrentTime(),
							currentState: $window.youtubePlayer.getPlayerState(),
							room : hash
						});
					})
				});
			}

			//makes the viewers synch to the host whenever the host emits a time event
			//recieves this event from the server when the server hears the hostPlayerState
			//even
			if(!host){
				socket.emit ('joinRoom', {room: roomId});

				socket.on("currentVideo", function(data){
					console.log("got data", data)
					setupPlayer(data.currentVideo, false)
				})

				socket.on("hostPlayerSync", function(data){
					console.log(data, "hostPlayerSync -- viewer")
					$window.youtubePlayer.seekTo(data.currentTime)
				})
			}

			socket.on('serverStateChange', function(data) {
				console.log('server changed my state', data);
				if (data === 2) {
					$window.youtubePlayer.pauseVideo();
				}
				if (data === 1) {
					$window.youtubePlayer.playVideo();
				}
			});
			//all users should be listening for and sending messages
			socket.on('newMessage', function(data) {
				console.log("message Recieved", data)
				messages.unshift({user : data.user, message : data.message, "userImage" : data.userImage})
				//force the scope to update, solved a strange error where
				//viewer messages weren't updating
				$rootScope.$apply()
				console.log($rootScope.user)
			});
		};

		//submits the message through socket IO whenever one is made
		$window.submitMessage = function(user, message){
			console.log("Message submitted")
			//grabs the username from Google account
			var username = $rootScope.user.username
			var userImage = $rootScope.user.photo
			//since our socket only currently sends to people who did
			//not brodcast we need to add the message to our messages array
			socket.emit('newMessage', {
				"user" : username,
				"message" : message,
				"userImage" : userImage,
				"room": videoId
			});
		}


		return {
			setupPlayer: setupPlayer,
			submitMessage : submitMessage,
			messages : messages,
			submitRoom: submitRoom
		};
	})
