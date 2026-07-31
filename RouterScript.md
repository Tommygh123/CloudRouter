:local projectRef "rzggsyktizptuaqjaers"
:local tenantId "7eaa0270-c0b7-48f2-8c62-7aebd6e80ca8"
:local routerId "26fcdb7c-c829-4987-9a25-736f75c09a96"
:local routerSecret "ispbilling-RB4011-v1_9X#K7mP2@Q5tL8\$W4cN6rH"
:local routerIdentity [/system identity get name]

:local pollUrl ("https://" . $projectRef . ".supabase.co/functions/v1/router-poll")
:local acknowledgeUrl ("https://" . $projectRef . ".supabase.co/functions/v1/router-acknowledge")
:local requestHeaders ("Content-Type:application/json,x-router-secret:" . $routerSecret)

:local pollPayload {"tenant_id"=$tenantId;"router_id"=$routerId;"router_identity"=$routerIdentity}
:local pollJson [:serialize value=$pollPayload to=json options=json.no-string-conversion]

:log info ("ISPBilling: Polling Supabase as router " . $routerIdentity)

:local pollResult

:onerror fetchError in={
    :set pollResult [/tool fetch url=$pollUrl http-method=post http-header-field=$requestHeaders http-data=$pollJson check-certificate=yes-without-crl output=user as-value]
} do={
    :log error ("ISPBilling: Could not contact router-poll. Error: " . $fetchError)
    :error "ISPBilling router polling stopped"
}

:local pollStatus ($pollResult->"status")
:local pollResponseText ($pollResult->"data")

:if ($pollStatus != "finished") do={
    :log error ("ISPBilling: router-poll request did not finish. Status: " . $pollStatus)
    :error "ISPBilling router-poll request failed"
}

:local pollResponse

:onerror jsonError in={
    :set pollResponse [:deserialize value=$pollResponseText from=json options=json.no-string-conversion]
} do={
    :log error ("ISPBilling: Invalid JSON received from router-poll. Response: " . $pollResponseText)
    :error "ISPBilling could not parse router-poll response"
}

:local requestSuccessful ($pollResponse->"success")

:if ($requestSuccessful != true) do={
    :local serverError ($pollResponse->"error")
    :log error ("ISPBilling: router-poll rejected the request. Error: " . $serverError)
    :error "ISPBilling router-poll rejected request"
}

:local hasJob ($pollResponse->"has_job")

:if ($hasJob != true) do={
    :log info "ISPBilling: No pending provisioning job found"
    :return
}

:local job ($pollResponse->"job")

:if ([:typeof $job] != "array") do={
    :log error "ISPBilling: Poll response did not contain a valid job"
    :error "Invalid provisioning job"
}

:local jobId ($job->"id")
:local hotspotUsername ($job->"username")
:local hotspotPassword ($job->"password")
:local hotspotProfile ($job->"profile_name")
:local macAddress ($job->"mac_address")
:local dataLimitBytes ($job->"data_limit_bytes")
:local uptimeLimitSeconds ($job->"uptime_limit_seconds")
:local sharedUsers ($job->"shared_users")
:local paymentReference ($job->"payment_reference")
:local orderId ($job->"order_id")

:if ([:len $jobId] = 0) do={
    :log error "ISPBilling: Provisioning job has no job ID"
    :error "Missing provisioning job ID"
}

:if ([:len $hotspotUsername] = 0) do={
    :log error ("ISPBilling: Job " . $jobId . " has no Hotspot username")
    :error "Missing Hotspot username"
}

:if ([:len $hotspotPassword] = 0) do={
    :log error ("ISPBilling: Job " . $jobId . " has no Hotspot password")
    :error "Missing Hotspot password"
}

:if ([:len $hotspotProfile] = 0) do={
    :log error ("ISPBilling: Job " . $jobId . " has no MikroTik profile")
    :error "Missing MikroTik profile"
}

:local acknowledgeStatus "completed"
:local failureReason ""
:local createdUser false

:local profileRecord [/ip hotspot user profile find where name=$hotspotProfile]

:if ([:len $profileRecord] = 0) do={
    :set acknowledgeStatus "failed"
    :set failureReason ("Hotspot profile not found: " . $hotspotProfile)
    :log error ("ISPBilling: " . $failureReason)
}

:if ($acknowledgeStatus = "completed") do={

    :local existingUser [/ip hotspot user find where name=$hotspotUsername]

    :if ([:len $existingUser] > 0) do={
        :log warning ("ISPBilling: Hotspot user already exists: " . $hotspotUsername . ". Treating job as completed.")
    } else={

        :local userComment ("ISPBilling job=" . $jobId . " order=" . $orderId . " payment=" . $paymentReference)
        :local uptimeText ""
        :local numericDataLimit 0

        :if ([:typeof $uptimeLimitSeconds] = "num") do={
            :if ($uptimeLimitSeconds > 0) do={
                :set uptimeText ([:tostr $uptimeLimitSeconds] . "s")
            }
        }

        :if ([:typeof $uptimeLimitSeconds] = "str") do={
            :if ([:len $uptimeLimitSeconds] > 0) do={
                :set uptimeText ($uptimeLimitSeconds . "s")
            }
        }

        :if ([:typeof $dataLimitBytes] = "num") do={
            :if ($dataLimitBytes > 0) do={
                :set numericDataLimit $dataLimitBytes
            }
        }

        :if ([:typeof $dataLimitBytes] = "str") do={
            :if ([:len $dataLimitBytes] > 0) do={
                :onerror conversionError in={
                    :set numericDataLimit [:tonum $dataLimitBytes]
                } do={
                    :set numericDataLimit 0
                    :log warning ("ISPBilling: Invalid data limit received: " . $dataLimitBytes)
                }
            }
        }

        :onerror createError in={

            :if (($numericDataLimit > 0) && ([:len $uptimeText] > 0)) do={
                /ip hotspot user add name=$hotspotUsername password=$hotspotPassword profile=$hotspotProfile limit-bytes-total=$numericDataLimit limit-uptime=$uptimeText comment=$userComment
            } else={
                :if ($numericDataLimit > 0) do={
                    /ip hotspot user add name=$hotspotUsername password=$hotspotPassword profile=$hotspotProfile limit-bytes-total=$numericDataLimit comment=$userComment
                } else={
                    :if ([:len $uptimeText] > 0) do={
                        /ip hotspot user add name=$hotspotUsername password=$hotspotPassword profile=$hotspotProfile limit-uptime=$uptimeText comment=$userComment
                    } else={
                        /ip hotspot user add name=$hotspotUsername password=$hotspotPassword profile=$hotspotProfile comment=$userComment
                    }
                }
            }

            :set createdUser true

        } do={
            :set acknowledgeStatus "failed"
            :set failureReason ("Could not create Hotspot user: " . $createError)
            :log error ("ISPBilling: " . $failureReason)
        }

        :if ($createdUser = true) do={
            :log info ("ISPBilling: Created Hotspot user " . $hotspotUsername . " with profile " . $hotspotProfile)
        }
    }
}

:if (($acknowledgeStatus = "completed") && ([:typeof $sharedUsers] != "nil")) do={
    :log info ("ISPBilling: Shared-users value received: " . $sharedUsers . ". This is controlled by the Hotspot user profile.")
}

:if (($acknowledgeStatus = "completed") && ([:typeof $macAddress] = "str") && ([:len $macAddress] > 0)) do={

    :local createdRecord [/ip hotspot user find where name=$hotspotUsername]

    :if ([:len $createdRecord] > 0) do={
        :onerror macError in={
            /ip hotspot user set $createdRecord mac-address=$macAddress
        } do={
            :log warning ("ISPBilling: User was created, but MAC binding failed: " . $macError)
        }
    }
}

:local routerResponse {"router_identity"=$routerIdentity;"username"=$hotspotUsername;"profile_name"=$hotspotProfile;"created_user"=$createdUser;"message"="Hotspot provisioning processed"}
:local acknowledgePayload

:if ($acknowledgeStatus = "completed") do={
    :set acknowledgePayload {"job_id"=$jobId;"router_id"=$routerId;"status"="completed";"router_response"=$routerResponse}
} else={
    :set acknowledgePayload {"job_id"=$jobId;"router_id"=$routerId;"status"="failed";"failure_reason"=$failureReason;"retry_delay_seconds"=30}
}

:local acknowledgeJson [:serialize value=$acknowledgePayload to=json options=json.no-string-conversion]
:local acknowledgeResult

:onerror acknowledgeError in={
    :set acknowledgeResult [/tool fetch url=$acknowledgeUrl http-method=post http-header-field=$requestHeaders http-data=$acknowledgeJson check-certificate=yes-without-crl output=user as-value]
} do={
    :log error ("ISPBilling: Could not acknowledge provisioning job " . $jobId . ". Error: " . $acknowledgeError)
    :error "ISPBilling acknowledgement failed"
}

:local acknowledgeStatusResult ($acknowledgeResult->"status")
:local acknowledgeText ($acknowledgeResult->"data")

:if ($acknowledgeStatusResult != "finished") do={
    :log error ("ISPBilling: Acknowledgement request did not finish. Status: " . $acknowledgeStatusResult)
    :error "ISPBilling acknowledgement request failed"
}

:local acknowledgeResponse

:onerror acknowledgeJsonError in={
    :set acknowledgeResponse [:deserialize value=$acknowledgeText from=json options=json.no-string-conversion]
} do={
    :log error ("ISPBilling: Invalid acknowledgement response: " . $acknowledgeText)
    :error "Could not parse acknowledgement response"
}

:if (($acknowledgeResponse->"success") = true) do={
    :log info ("ISPBilling: Job " . $jobId . " acknowledged as " . $acknowledgeStatus)
} else={
    :log error ("ISPBilling: Server rejected acknowledgement for job " . $jobId . ". Response: " . $acknowledgeText)
}