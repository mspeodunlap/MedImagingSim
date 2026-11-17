# MedImagingSim project instructions

Maintain [the user guide](docs/USER_GUIDE.md) in the same change as every new feature or change to existing behavior. Update affected role permissions, steps, screen labels, expected results, and troubleshooting. Use the app's actual labels and verify the documented workflow against the implementation. Record technical changes and milestone handoffs in [the milestone plan](MILESTONE_PLAN.md).

Publish the existing MedImagingSim build and every subsequent release to the dedicated ThinkPad T450s tester host through GitHub `main`. Run the tests before publication. Verify the intended Git commit on the ThinkPad and confirm HTTPS sign-in and the changed or representative workflow from a separate LAN device. Preserve the host's tester database and record the deployed commit and verification result in the milestone handoff. Report any unfinished publication or verification as pending. Follow the [ThinkPad hosting runbook](docs/LAN_HOSTING.md).
