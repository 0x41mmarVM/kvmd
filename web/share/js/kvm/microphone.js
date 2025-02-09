/*****************************************************************************
#                                                                            #
#    KVMD - The main PiKVM daemon.                                           #
#                                                                            #
#    Copyright (C) 2018-2024  Maxim Devaev <mdevaev@gmail.com>               #
#                                                                            #
#    This program is free software: you can redistribute it and/or modify    #
#    it under the terms of the GNU General Public License as published by    #
#    the Free Software Foundation, either version 3 of the License, or       #
#    (at your option) any later version.                                     #
#                                                                            #
#    This program is distributed in the hope that it will be useful,         #
#    but WITHOUT ANY WARRANTY; without even the implied warranty of          #
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           #
#    GNU General Public License for more details.                            #
#                                                                            #
#    You should have received a copy of the GNU General Public License       #
#    along with this program.  If not, see <https://www.gnu.org/licenses/>.  #
#                                                                            #
*****************************************************************************/


"use strict";


import { tools, $ } from "../tools.js";



export function Microphone() {
	var self = this;
	var _Janus = null
	var __janus = null;
	var __handle = null;
	var webrtcUp = false;
	var stereo = false;
	var joined = false;
	var muted = false;

	/************************************************************************/

	var __init__ = function () {
		$("microphone-button").setAttribute("disabled", true)
		__ensure_janus((success)=>{
			if (success) {
				__start_janus()
			}
		})
		tools.el.setOnClick($("mute-button"), __toggleMute);
	};

	var __logInfo = (...args) => tools.info("Microphone [Janus]:", ...args);
	var __logError = (...args) => tools.error("Microphone [Janus]:", ...args);
	/************************************************************************/

	var __ensure_janus = function (callback) {
		if (_Janus === null) {
			import("./janus.js").then((module) => {
				module.Janus.init({
					"debug": "all",
					"callback": function () {
						_Janus = module.Janus;
						callback(true);
					},
				});
			}).catch((err) => {
				tools.error("Microphone: Can't import Janus module:", err);
				callback(false);
			});
		} else {
			callback(true);
		}
	};

	var __start_janus = function () {
		if (__janus === null) {
			__logInfo("Starting Microphone Janus ...");
			__janus = new _Janus({
				"server": `${tools.is_https ? "wss" : "ws"}://${location.host}/janus/ws`,
				"ipv6": true,
				"destroyOnUnload": false,
				"success": __attachJanus,
				"error": function (error) {
					__logError(error);
				},
			});
		}
	}



	var __attachJanus = function () {
		if (__janus === null) {
			return;
		}
		__janus.attach({
			"plugin": "janus.plugin.audiobridge",
			"opaqueId": "oid-" + _Janus.randomString(12),

			"success": function (handle) {
				__handle = handle;
				__logInfo("Microphone attached:", handle.getPlugin(), handle.getId());
				tools.el.setOnClick($("microphone-button"), __joinAudio);
				$("microphone-button").removeAttribute("disabled")
			},

			"error": function (error) {
				__logError("Can't attach Microphone: ", error);
				__destroyJanus();
			},

			"onmessage": function (msg, jsep) {
				var event = msg["audiobridge"];
				if (event) {
					__logInfo("Event: " + event);
					if (event === "joined") {
						// Successfully joined, negotiate WebRTC now
						if (msg["id"]) {
							var myid = msg["id"];
							__logInfo("Successfully joined audio room " + msg["room"] + " with ID " + myid);
							if (!webrtcUp) {
								webrtcUp = true;
								// Publish our stream
								__handle.createOffer({
									media: {
										video: false
									}, // This is an audio only room
									customizeSdp: function (jsep) {
										if (stereo && jsep.sdp.indexOf("stereo=1") == -1) {
											jsep.sdp = jsep.sdp.replace("useinbandfec=1", "useinbandfec=1;stereo=1");
										}
									},
									success: function (jsep) {
										__logInfo("Got SDP!", jsep);
										var publish = {
											request: "configure",
											muted: false
										};
										__handle.send({
											message: publish,
											jsep: jsep
										});
									},
									error: function (error) {
										__logError("WebRTC error:"+ error);
										if (error == "getUserMedia not available")
											return __logError("Microphone permissions not available. Either due to permissions, or running in an insecure context");
									}
								});
							}
							$("microphone-button").setAttribute("disabled", true)
						}
					} else if (event === "event") {
						if (msg["error"]) {
							if (msg["error_code"] === 485) {
								__logError("Audio room does not exist. Server is misconfigured")
							} else {
								__logError(msg["error"]);
							}
							return;
						}
					}
				}

				if (jsep) {
					__logInfo("Handling SDP:", jsep);
					__handle.handleRemoteJsep({
						jsep: jsep
					});
				}
			},
			"onlocaltrack": function (track, on) {
				__logInfo("Local micropohne track " + (on ? "added" : "removed") + ":", track)
			},
			// Janus 1.x
			"onremotetrack": function (track, id, added, meta) { },
			// Janus 0.x
			"onremotestream": function (stream) { },

			"oncleanup": function () {
				__logInfo("Got a cleanup notification");
			},
		});
	};

	var __joinAudio = function () {
		if (joined)
			return
		var btn = $("microphone-button")
		var muteBtn = $("mute-button")
		btn.setAttribute("disabled", true)
		btn.classList.add("row50")
		muteBtn.classList.remove("hidden")
		btn.innerText = "Microphone Started"
		var username = _Janus.randomString(12)
		var register = { request: "join", room: 1234, display: username, codec: "opus"};
		__handle.send({ message: register });
	}

	var __toggleMute = function() {
		if (!__handle)
			return
		var muteBtn = $("mute-button")
		__handle.send({ message: { request: "configure", muted: !muted }})
		if (muted) {
			muted = false
			muteBtn.classList.remove("enabled")
		}
		else {
			muted = true
			muteBtn.classList.add("enabled")
		}

	}

	__init__();
}
