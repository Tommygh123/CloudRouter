This is a **major breakthrough**. It tells us exactly where the problem is.

### What we've proven

✅ Hotspot server works.

✅ `GHS1-200MB` profile works.

✅ Manual user with the same profile works.

✅ MikroTik automatically learns and uses the PC's MAC address after a successful login (that's normal because `add-mac-cookie=yes` is enabled in the user profile).

❌ Only the automatically provisioned user (`ISP-FGLB657Y`) cannot authenticate.

That means the problem is **not** the hotspot configuration or profile—it's almost certainly in how the provisioning script creates the user.

## Next diagnostic

Please run:

```routeros
/ip hotspot user export where name="ISP-FGLB657Y"
```

and also:

```routeros
/ip hotspot user export where name="ISP-CLEANTEST"
```

I want to compare the two exported commands line by line.

## My leading suspicion

Your provisioning script extracts values from the JSON response. For example, it probably does something like:

```routeros
:local username ...
:local password ...
```

If the parser leaves an extra quote (`"`), carriage return (`\r`), newline (`\n`), or other invisible character on either value, RouterOS will store it. The `print detail` output won't show those invisible characters, but authentication will fail.

The fact that:

* `ISP-CLEANTEST` logs in immediately,
* while `ISP-FGLB657Y` (created by the script) does not,

is a very strong indicator that the provisioning script is the source of the problem.

## About automatic internet access

You also noticed that `ISP-CLEANTEST` showed your PC's MAC address automatically. That's expected. After a successful login, MikroTik records the device's MAC (and, with `add-mac-cookie=yes`, creates a MAC cookie). This is the mechanism we can use to implement your planned **pay → immediate internet access** flow.

The ideal production workflow will be:

1. Customer connects to Wi-Fi.
2. Hotspot page captures the device's MAC address.
3. Customer pays.
4. Supabase queues the provisioning job with that MAC address.
5. Router creates the hotspot user and associates it with the customer's device.
6. Customer is automatically authenticated—no need to type a username and password.

So we're very close. The remaining task is to correct the provisioning script so it creates credentials exactly like the manual `ISP-CLEANTEST` user, and then we can build the automatic login experience.
